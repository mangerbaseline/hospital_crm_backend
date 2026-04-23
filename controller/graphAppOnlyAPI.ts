import type { Request, Response } from 'express';
import * as msal from '@azure/msal-node';
import type { AuthRequest } from '../middleware/authMiddleware.ts';

/**
 * Configuration for MSAL Confidential Client (Application Access)
 */
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

/**
 * Helper to get MSAL Client Instance
 */
const getMsalClient = () => {
    return new msal.ConfidentialClientApplication(getMsalConfig());
};

/**
 * Get Access Token using Client Credentials (App-Only)
 */
const getAppOnlyToken = async () => {
    const client = getMsalClient();
    const tokenRequest = {
        scopes: ['https://graph.microsoft.com/.default'],
    };

    const response = await client.acquireTokenByClientCredential(tokenRequest);
    if (!response) throw new Error('Failed to acquire App-Only token');
    return response.accessToken;
};

/**
 * Fetch Messages from ANY mailbox (App-Only)
 * Usage: GET /api/graph-app/messages/:email
 */
export const getMailboxMessages = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { email } = req.params;
        if (!email) {
            res.status(400).json({ success: false, message: 'Mailbox email is required' });
            return;
        }

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

/**
 * Send Email from ANY mailbox (App-Only)
 * Usage: POST /api/graph-app/send
 * Body: { fromEmail, toEmail, subject, content }
 */
export const sendMailFromMailbox = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { fromEmail, toEmail, subject, content } = req.body;

        if (!fromEmail || !toEmail || !subject || !content) {
            res.status(400).json({ success: false, message: 'Missing required fields (fromEmail, toEmail, subject, content)' });
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
