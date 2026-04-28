import type { Request, Response } from 'express';
import * as msal from '@azure/msal-node';

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

const processMessageAttachments = async (accessToken: string, userId: string, message: any) => {
    // Initialize attachments array for the message object
    message.attachments = [];

    if (!message.hasAttachments) return;

    try {
        const response = await fetch(`https://graph.microsoft.com/v1.0/users/${userId}/messages/${message.id}/attachments`, {
            headers: { Authorization: `Bearer ${accessToken}` },
        });

        if (!response.ok) return;

        const data = await response.json();
        const attachments = data.value || [];

        let bodyContent = message.body?.content || "";
        let replacedCount = 0;
        const storedAttachments: any[] = [];

        attachments.forEach((attachment: any) => {
            // Store all attachments in the message object for DB persistence
            if (attachment.contentBytes) {
                storedAttachments.push({
                    name: attachment.name || 'attachment',
                    contentType: attachment.contentType || 'application/octet-stream',
                    contentId: attachment.contentId || '',
                    contentBytes: attachment.contentBytes,
                    isInline: attachment.isInline || !!attachment.contentId
                });
            }

            // Handle inline replacement
            if (attachment.contentId && attachment.contentBytes) {
                const cid = attachment.contentId;
                const base64Data = `data:${attachment.contentType || 'image/png'};base64,${attachment.contentBytes}`;

                // Improved Regex: match cid:ID, cid:<ID>, and handle potential extensions in HTML (e.g. cid:ID.png)
                // Escape CID for regex
                const escapedCid = cid.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const regex = new RegExp(`cid:<?${escapedCid}(?:\\.[a-zA-Z0-9]+)?>?`, 'g');

                if (regex.test(bodyContent)) {
                    bodyContent = bodyContent.replace(regex, base64Data);
                    replacedCount++;
                }
            }
        });

        // Update message object with processed content and attachments
        if (message.body) {
            message.body.content = bodyContent;
        }
        message.attachments = storedAttachments;

        if (replacedCount > 0) {
            console.log(`Successfully replaced ${replacedCount} inline images for message: ${message.subject}`);
        }
    } catch (error) {
        console.error(`Error processing attachments for message ${message.id}:`, error);
    }
};

const syncMailboxMessages = async (req: any, res: any): Promise<void> => {
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
        const graphResponse = await fetch(`https://graph.microsoft.com/v1.0/users/${email}/messages?$top=200`, {
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

        if (messages.length === 0) {
            res.status(200).json({
                success: true,
                message: `No new messages found for ${email}`,
                count: 0
            });
            return;
        }

        // 3. Process Inline Attachments (CIDs)
        await Promise.all(messages.map((msg: any) => processMessageAttachments(accessToken, email, msg)));

        // 4. Prepare Bulk Operations to avoid duplicates using graphId
        const ops = messages.map((msg: any) => ({
            updateOne: {
                filter: { graphId: msg.id },
                update: {
                    $set: {
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
                        attachments: msg.attachments,
                        crmUser: req.user?._id
                    }
                },
                upsert: true
            }
        }));

        // 4. Execute Bulk Write
        // const result = await Email.bulkWrite(ops);
        const result = 'abc';

        res.status(200).json({
            success: true,
            message: `Successfully synced messages for ${email}`,
            stats: {
                totalSynced: messages.length,
                // newlyAdded: result.upsertedCount,
                // updated: result.modifiedCount
            }
        });

    } catch (error: any) {
        console.error('Sync Mailbox Error:', error);
        res.status(500).json({ success: false, message: 'Internal Server Error', error: error.message });
    }
};

syncMailboxMessages('abc', 'any')