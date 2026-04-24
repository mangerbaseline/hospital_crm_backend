import type { Request, Response } from 'express';
import * as msal from '@azure/msal-node';
import type { AuthRequest } from '../middleware/authMiddleware.ts';
import Email from '../model/email.ts';


const getMsalConfig = () => {
    let privateKey = process.env.MS_GRAPH_PRIVATE_KEY;
    const thumbprint = process.env.MS_GRAPH_CERT_THUMBPRINT;
    const clientId = process.env.MS_GRAPH_CLIENT_ID;
    const tenantId = process.env.MS_GRAPH_TENANT_ID || 'common';

    if (!privateKey || !thumbprint || !clientId) {
        throw new Error('Missing MS Graph configuration (Private Key, Thumbprint, or Client ID) in .env');
    }

    // Fix for .env files where newlines are escaped as \n
    if (privateKey && privateKey.includes('\\n')) {
        privateKey = privateKey.replace(/\\n/g, '\n');
    }

    return {
        auth: {
            clientId: clientId,
            authority: `https://login.microsoftonline.com/${tenantId}`,
            clientCertificate: {
                thumbprint: thumbprint,
                privateKey: privateKey,
            }
        }
    };
};


const getMsalClient = () => {
    return new msal.ConfidentialClientApplication(getMsalConfig());
};


const getAppOnlyToken = async () => {
    const client = getMsalClient();
    const tokenRequest = {
        scopes: ['https://graph.microsoft.com/.default'],
    };

    const response = await client.acquireTokenByClientCredential(tokenRequest);
    if (!response) throw new Error('Failed to acquire App-Only token');
    return response.accessToken;
};


export const getMailboxMessages = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        if (!req.user || !req.user.email) {
            res.status(401).json({ success: false, message: 'User not authenticated or email missing' });
            return;
        }

        const email = req.user.email;

        // 1. Get Application Token
        const accessToken = await getAppOnlyToken();

        // 2. Call Graph API for the specific user mailbox
        const graphResponse = await fetch(`https://graph.microsoft.com/v1.0/users/${email}/messages`, {
            headers: { Authorization: `Bearer ${accessToken}` },
        });

        const data = await graphResponse.json();

        if (!graphResponse.ok) {
            res.status(graphResponse.status).json({
                success: false,
                message: 'Failed to fetch messages from mailbox',
                error: data
            });
            return;
        }

        res.status(200).json({
            success: true,
            mailbox: email,
            data: data.value
        });

    } catch (error: any) {
        console.error('App-Only Graph Error:', error);
        res.status(500).json({ success: false, message: 'Internal Server Error', error: error.message });
    }
};


export const sendMailFromMailbox = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { toEmail, subject, content } = req.body;
        const fromEmail = req.user?.email;

        if (!fromEmail || !toEmail || !subject || !content) {
            res.status(400).json({ success: false, message: 'Missing required fields (toEmail, subject, content) or user email' });
            return;
        }

        // 1. Get Application Token
        const accessToken = await getAppOnlyToken();

        // 2. Prepare the Email Payload
        const mailPayload = {
            message: {
                subject: subject,
                body: {
                    contentType: 'HTML',
                    content: content,
                },
                toRecipients: [
                    {
                        emailAddress: {
                            address: toEmail,
                        },
                    },
                ],
            },
            saveToSentItems: 'true',
        };

        // 3. Call Graph API to send the mail
        const graphResponse = await fetch(`https://graph.microsoft.com/v1.0/users/${fromEmail}/sendMail`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(mailPayload),
        });

        if (!graphResponse.ok) {
            const errorData = await graphResponse.json();
            res.status(graphResponse.status).json({
                success: false,
                message: 'Failed to send email',
                error: errorData
            });
            return;
        }

        res.status(200).json({ success: true, message: `Email sent successfully from ${fromEmail}` });

    } catch (error: any) {
        console.error('App-Only Send Mail Error:', error);
        res.status(500).json({ success: false, message: 'Internal Server Error', error: error.message });
    }
};


export const syncMailboxMessages = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        if (!req.user || !req.user.email) {
            res.status(401).json({ success: false, message: 'User not authenticated or email missing' });
            return;
        }

        const email = req.user.email;

        // 1. Get Application Token
        const accessToken = await getAppOnlyToken();

        // 2. Call Graph API for messages
        // Limiting to top 50 for now
        const graphResponse = await fetch(`https://graph.microsoft.com/v1.0/users/${email}/messages?$top=50`, {
            headers: { Authorization: `Bearer ${accessToken}` },
        });

        const data = await graphResponse.json();

        if (!graphResponse.ok) {
            res.status(graphResponse.status).json({
                success: false,
                message: 'Failed to fetch messages from Microsoft Graph',
                error: data
            });
            return;
        }

        const messages = data.value || [];
        const syncResults = [];

        // 3. Map and Upsert into MongoDB
        for (const msg of messages) {
            const emailDoc = {
                graphId: msg.id,
                sender: msg.sender?.emailAddress,
                from: msg.from?.emailAddress,
                toRecipients: msg.toRecipients?.map((r: any) => r.emailAddress) || [],
                ccRecipients: msg.ccRecipients?.map((r: any) => r.emailAddress) || [],
                bccRecipients: msg.bccRecipients?.map((r: any) => r.emailAddress) || [],
                subject: msg.subject,
                bodyPreview: msg.bodyPreview,
                body: msg.body,
                receivedDateTime: msg.receivedDateTime,
                sentDateTime: msg.sentDateTime,
                hasAttachments: msg.hasAttachments,
                isRead: msg.isRead,
                isDraft: msg.isDraft,
                webLink: msg.webLink,
                conversationId: msg.conversationId,
                importance: msg.importance,
                crmUser: req.user._id
            };

            // Use findOneAndUpdate with upsert:true to avoid duplicates
            const result = await Email.findOneAndUpdate(
                { graphId: msg.id },
                emailDoc,
                { upsert: true, returnDocument: 'after' }
            );
            syncResults.push(result);
        }

        res.status(200).json({
            success: true,
            message: `Successfully synced ${syncResults.length} messages for ${email}`,
            count: syncResults.length
        });

    } catch (error: any) {
        console.error('Sync Mailbox Error:', error);
        res.status(500).json({ success: false, message: 'Internal Server Error', error: error.message });
    }
};


export const getSentEmailsFromDB = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        if (!req.user) {
            res.status(401).json({ success: false, message: 'User not authenticated' });
            return;
        }

        const { page = 1, search = '' } = req.query;
        const limit = 10;
        const skip = (Number(page) - 1) * limit;
        const userEmail = req.user.email.toLowerCase();

        // 1. Build Query: Emails sent BY the user
        const query: any = {
            crmUser: req.user._id,
            'from.address': userEmail
        };

        if (search) {
            const searchRegex = new RegExp(search as string, 'i');
            query.$or = [
                { subject: searchRegex },
                { 'from.address': searchRegex },
                { 'toRecipients.address': searchRegex }
            ];
        }

        // 2. Fetch paginated sent emails
        const emails = await Email.find(query)
            .sort({ receivedDateTime: -1 })
            .skip(skip)
            .limit(limit);

        const totalEmails = await Email.countDocuments(query);

        res.status(200).json({
            success: true,
            data: emails,
            pagination: {
                total: totalEmails,
                page: Number(page),
                limit: limit,
                totalPages: Math.ceil(totalEmails / limit)
            }
        });

    } catch (error: any) {
        console.error('Fetch Sent Emails Error:', error);
        res.status(500).json({ success: false, message: 'Internal Server Error', error: error.message });
    }
};


export const getReceivedEmailsFromDB = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        if (!req.user) {
            res.status(401).json({ success: false, message: 'User not authenticated' });
            return;
        }

        const { page = 1, search = '' } = req.query;
        const limit = 10;
        const skip = (Number(page) - 1) * limit;
        const userEmail = req.user.email.toLowerCase();

        // 1. Build Query: Emails received BY the user (from address is not theirs)
        const query: any = {
            crmUser: req.user._id,
            'from.address': { $ne: userEmail }
        };

        if (search) {
            const searchRegex = new RegExp(search as string, 'i');
            query.$and = [
                { 'from.address': { $ne: userEmail } }, // Re-ensure received
                {
                    $or: [
                        { subject: searchRegex },
                        { 'from.address': searchRegex },
                        { 'toRecipients.address': searchRegex }
                    ]
                }
            ];
            // Remove the top-level 'from.address' if search is present to avoid conflict, 
            // though $and handles it fine. Let's keep it simple.
            delete query['from.address'];
        }

        // 2. Fetch paginated received emails
        const emails = await Email.find(query)
            .sort({ receivedDateTime: -1 })
            .skip(skip)
            .limit(limit);

        const totalEmails = await Email.countDocuments(query);

        res.status(200).json({
            success: true,
            data: emails,
            pagination: {
                total: totalEmails,
                page: Number(page),
                limit: limit,
                totalPages: Math.ceil(totalEmails / limit)
            }
        });

    } catch (error: any) {
        console.error('Fetch Received Emails Error:', error);
        res.status(500).json({ success: false, message: 'Internal Server Error', error: error.message });
    }
};
