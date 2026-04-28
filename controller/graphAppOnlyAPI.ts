import type { Request, Response } from "express";
import * as msal from "@azure/msal-node";
import type { AuthRequest } from "../middleware/authMiddleware.ts";
import Email from "../model/email.ts";
import fs from "fs";
import path from "path";

const getMsalConfig = () => {
  let privateKey = process.env.MS_GRAPH_PRIVATE_KEY;
  const thumbprint = process.env.MS_GRAPH_CERT_THUMBPRINT;
  const clientId = process.env.MS_GRAPH_CLIENT_ID;
  const tenantId = process.env.MS_GRAPH_TENANT_ID || "common";

  if (!privateKey || !thumbprint || !clientId) {
    throw new Error(
      "Missing MS Graph configuration (Private Key, Thumbprint, or Client ID) in .env",
    );
  }

  // Fix for .env files where newlines are escaped as \n
  if (privateKey && privateKey.includes("\\n")) {
    privateKey = privateKey.replace(/\\n/g, "\n");
  }

  return {
    auth: {
      clientId: clientId,
      authority: `https://login.microsoftonline.com/${tenantId}`,
      clientCertificate: {
        thumbprint: thumbprint,
        privateKey: privateKey,
      },
    },
  };
};

const getMsalClient = () => {
  return new msal.ConfidentialClientApplication(getMsalConfig());
};

const getAppOnlyToken = async () => {
  const client = getMsalClient();
  const tokenRequest = {
    scopes: ["https://graph.microsoft.com/.default"],
  };

  const response = await client.acquireTokenByClientCredential(tokenRequest);
  if (!response) throw new Error("Failed to acquire App-Only token");
  return response.accessToken;
};

const processMessageAttachments = async (
  accessToken: string,
  userId: string,
  message: any,
) => {
  // Initialize attachments array for the message object
  message.attachments = [];

  if (!message.hasAttachments) return;

  try {
    const response = await fetch(
      `https://graph.microsoft.com/v1.0/users/${userId}/messages/${message.id}/attachments`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );

    if (!response.ok) return;

    const data = await response.json();
    const attachments = data.value || [];

    let bodyContent = message.body?.content || "";
    let replacedCount = 0;
    const storedAttachments: any[] = [];

    // Ensure uploads directory exists
    const uploadDir = path.join(process.cwd(), "uploads");
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    attachments.forEach((attachment: any) => {
      let fileUrl = "";

      // Store all attachments in the message object for DB persistence
      if (attachment.contentBytes) {
        try {
          // Generate a safe filename
          const safeFilename = `${message.id}-${attachment.id || Math.random().toString(36).substring(7)}`.replace(/[^a-zA-Z0-9.-]/g, "_");
          const extension = attachment.name ? path.extname(attachment.name) : "";
          const filename = `${safeFilename}${extension}`;
          const filePath = path.join(uploadDir, filename);

          // Save file to disk
          fs.writeFileSync(filePath, Buffer.from(attachment.contentBytes, "base64"));

          // Set the public URL
          fileUrl = `https://hospital-crm-backend-prp5.onrender.com/uploads/${filename}`;

          storedAttachments.push({
            name: attachment.name || "attachment",
            contentType: attachment.contentType || "application/octet-stream",
            contentId: attachment.contentId || "",
            contentBytes: attachment.contentBytes.length > 1024 * 1024 ? "" : attachment.contentBytes, // Clear bytes if > 1MB to save DB space
            fileUrl: fileUrl,
            isInline: attachment.isInline || !!attachment.contentId,
          });
        } catch (fileError) {
          console.error("Error saving attachment to disk:", fileError);
        }
      }

      // Handle inline replacement (CID to URL)
      if (attachment.contentId && fileUrl) {
        const cid = attachment.contentId;
        // Escape CID for regex
        const escapedCid = cid.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const regex = new RegExp(
          `cid:<?${escapedCid}(?:\\.[a-zA-Z0-9]+)?>?`,
          "g",
        );

        if (regex.test(bodyContent)) {
          bodyContent = bodyContent.replace(regex, fileUrl);
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
      console.log(
        `Successfully replaced ${replacedCount} inline images for message: ${message.subject}`,
      );
    }
  } catch (error) {
    console.error(
      `Error processing attachments for message ${message.id}:`,
      error,
    );
  }
};

export const getMailboxMessages0 = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user || !req.user.email) {
      res.status(401).json({
        success: false,
        message: "User not authenticated or email missing",
      });
      return;
    }

    const email = req.user.email;

    // 1. Get Application Token
    const accessToken = await getAppOnlyToken();

    // 2. Call Graph API for the specific user mailbox
    const graphResponse = await fetch(
      `https://graph.microsoft.com/v1.0/users/${email}/messages`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );

    const data = await graphResponse.json();

    if (!graphResponse.ok) {
      res.status(graphResponse.status).json({
        success: false,
        message: "Failed to fetch messages from mailbox",
        error: data,
      });
      return;
    }

    const messages = data.value || [];

    // 3. Process Inline Attachments (CIDs) for UI display
    await Promise.all(
      messages.map((msg: any) =>
        processMessageAttachments(accessToken, email, msg),
      ),
    );

    res.status(200).json({
      success: true,
      mailbox: email,
      data: messages,
    });
  } catch (error: any) {
    console.error("App-Only Graph Error:", error);
    res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

export const getMailboxMessages = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { email } = req.params;

    if (!email) {
      res
        .status(400)
        .json({ success: false, message: "Email is required in params" });
      return;
    }

    // 1. Get App Token
    const accessToken = await getAppOnlyToken();

    // 2. Call Graph API
    const graphResponse = await fetch(
      `https://graph.microsoft.com/v1.0/users/${email}/messages`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );

    const data = await graphResponse.json();

    if (!graphResponse.ok) {
      res.status(graphResponse.status).json({
        success: false,
        message: "Failed to fetch messages",
        error: data,
      });
      return;
    }

    const messages = data.value || [];

    res.status(200).json({
      success: true,
      mailbox: email,
      count: messages.length,
      data: messages,
    });
  } catch (error: any) {
    console.error("Graph Error:", error);
    res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

export const sendMailFromMailbox = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const { toEmail, subject, content, ccEmails } = req.body;
    const fromEmail = req.user?.email;

    if (!fromEmail || !toEmail || !subject || !content) {
      res.status(400).json({
        success: false,
        message:
          "Missing required fields (toEmail, subject, content) or user email",
      });
      return;
    }

    // 1. Get Application Token
    const accessToken = await getAppOnlyToken();

    // 2. Prepare the CC Recipients if provided
    let ccRecipients: any[] = [];
    if (ccEmails) {
      const ccList = Array.isArray(ccEmails)
        ? ccEmails
        : ccEmails.split(",").map((e: string) => e.trim());
      ccRecipients = ccList
        .filter((e: string) => e)
        .map((email: string) => ({
          emailAddress: { address: email },
        }));
    }

    // 3. Handle Inline Attachments (CIDs)
    const attachments: any[] = [];
    const cidRegex = /cid:<?([a-zA-Z0-9.\-_@]+)>?/g;
    let match;
    const foundCids = new Set<string>();

    while ((match = cidRegex.exec(content)) !== null) {
      if (match[1]) {
        foundCids.add(match[1]);
      }
    }

    if (foundCids.size > 0) {
      console.log(
        `Found ${foundCids.size} CIDs in email content. Searching for bytes...`,
      );

      // Optimize: Search for all CIDs at once
      const cidList = Array.from(foundCids);
      const cidPrefixes = cidList.map((c) => c.split(".")[0]);

      const emailsWithAttachments = await Email.find({
        $or: [
          { "attachments.contentId": { $in: cidList } },
          { "attachments.contentId": { $in: cidPrefixes } },
        ],
      }).select("attachments");

      for (const cid of foundCids) {
        const cidPrefix = cid.split(".")[0];
        let foundAttachment = null;

        for (const emailDoc of emailsWithAttachments) {
          if (emailDoc.attachments) {
            foundAttachment = emailDoc.attachments.find(
              (a) => a.contentId === cid || a.contentId === cidPrefix,
            );
            if (foundAttachment) break;
          }
        }

        if (foundAttachment) {
          attachments.push({
            "@odata.type": "#microsoft.graph.fileAttachment",
            name: foundAttachment.name,
            contentType: foundAttachment.contentType,
            contentBytes: foundAttachment.contentBytes,
            contentId: cid, // Use the CID as found in the HTML
            isInline: true,
          });
          console.log(`Attached inline image for CID: ${cid}`);
        }
      }
    }

    // 4. Prepare the Email Payload
    const mailPayload: any = {
      message: {
        subject: subject,
        body: {
          contentType: "HTML",
          content: content,
        },
        toRecipients: [
          {
            emailAddress: {
              address: toEmail,
            },
          },
        ],
        ccRecipients: ccRecipients,
        attachments: attachments,
      },
      saveToSentItems: "true",
    };

    // 5. Call Graph API to send the mail
    const graphResponse = await fetch(
      `https://graph.microsoft.com/v1.0/users/${fromEmail}/sendMail`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(mailPayload),
      },
    );

    if (!graphResponse.ok) {
      const errorData = await graphResponse.json();
      res.status(graphResponse.status).json({
        success: false,
        message: "Failed to send email",
        error: errorData,
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: `Email sent successfully from ${fromEmail}`,
    });
  } catch (error: any) {
    console.error("App-Only Send Mail Error:", error);
    res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

export const getSentEmailsFromDB = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user) {
      res
        .status(401)
        .json({ success: false, message: "User not authenticated" });
      return;
    }

    const { page = 1, search = "" } = req.query;
    const limit = 10;
    const skip = (Number(page) - 1) * limit;
    const userEmail = req.user.email.toLowerCase();

    // 1. Build Base Match: All emails for this CRM user
    const baseMatch: any = { crmUser: req.user._id };

    // 2. Define the common aggregation stages for threading and filtering
    const threadingStages: any[] = [
      { $match: baseMatch },
      // Normalize subject to group "RE: Subject" with "Subject"
      {
        $addFields: {
          normalizedSubject: {
            $trim: {
              input: {
                $regexReplace: {
                  input: { $ifNull: ["$subject", ""] },
                  find: "^(?i)(re|fw|fwd|aw|reply|forward):\\s*",
                  replacement: "",
                },
              },
            },
          },
        },
      },
      {
        $addFields: {
          threadId: { $ifNull: ["$conversationId", "$normalizedSubject"] },
        },
      },
      { $sort: { receivedDateTime: -1 } },
      {
        $group: {
          _id: "$threadId",
          latestDoc: { $first: "$$ROOT" },
          hasSent: {
            $max: {
              $cond: [{ $eq: ["$from.address", userEmail] }, true, false],
            },
          },
          // Search criteria: check if ANY message in the thread matches the search
          searchMatch: search
            ? {
                $max: {
                  $or: [
                    {
                      $regexMatch: {
                        input: { $ifNull: ["$subject", ""] },
                        regex: search as string,
                        options: "i",
                      },
                    },
                    {
                      $regexMatch: {
                        input: { $ifNull: ["$from.address", ""] },
                        regex: search as string,
                        options: "i",
                      },
                    },
                    {
                      $regexMatch: {
                        input: { $ifNull: ["$bodyPreview", ""] },
                        regex: search as string,
                        options: "i",
                      },
                    },
                  ],
                },
              }
            : true,
        },
      },
      // Filter: Must have at least one sent message and match search
      { $match: { hasSent: true, searchMatch: true } },
    ];

    // 3. Execute List Query
    const emails = await Email.aggregate([
      ...threadingStages,
      { $replaceRoot: { newRoot: "$latestDoc" } },
      { $sort: { receivedDateTime: -1 } },
      { $skip: skip },
      { $limit: limit },
    ]);

    // 4. Execute Count Query
    const countResult = await Email.aggregate([
      ...threadingStages,
      { $count: "total" },
    ]);
    const totalEmails = countResult.length > 0 ? countResult[0].total : 0;

    res.status(200).json({
      success: true,
      data: emails,
      pagination: {
        total: totalEmails,
        page: Number(page),
        limit: limit,
        totalPages: Math.ceil(totalEmails / limit),
      },
    });
  } catch (error: any) {
    console.error("Fetch Sent Emails Error:", error);
    res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

export const getReceivedEmailsFromDB = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user) {
      res
        .status(401)
        .json({ success: false, message: "User not authenticated" });
      return;
    }

    const { page = 1, search = "" } = req.query;
    const limit = 10;
    const skip = (Number(page) - 1) * limit;
    const userEmail = req.user.email.toLowerCase();

    // 1. Build Base Match: All emails for this CRM user
    const baseMatch: any = { crmUser: req.user._id };

    // 2. Define the common aggregation stages for threading and filtering
    const threadingStages: any[] = [
      { $match: baseMatch },
      // Normalize subject to group "RE: Subject" with "Subject"
      {
        $addFields: {
          normalizedSubject: {
            $trim: {
              input: {
                $regexReplace: {
                  input: { $ifNull: ["$subject", ""] },
                  find: "^(?i)(re|fw|fwd|aw|reply|forward):\\s*",
                  replacement: "",
                },
              },
            },
          },
        },
      },
      {
        $addFields: {
          threadId: { $ifNull: ["$conversationId", "$normalizedSubject"] },
        },
      },
      { $sort: { receivedDateTime: -1 } },
      {
        $group: {
          _id: "$threadId",
          latestDoc: { $first: "$$ROOT" },
          hasReceived: {
            $max: {
              $cond: [{ $ne: ["$from.address", userEmail] }, true, false],
            },
          },
          // Search criteria: check if ANY message in the thread matches the search
          searchMatch: search
            ? {
                $max: {
                  $or: [
                    {
                      $regexMatch: {
                        input: { $ifNull: ["$subject", ""] },
                        regex: search as string,
                        options: "i",
                      },
                    },
                    {
                      $regexMatch: {
                        input: { $ifNull: ["$from.address", ""] },
                        regex: search as string,
                        options: "i",
                      },
                    },
                    {
                      $regexMatch: {
                        input: { $ifNull: ["$bodyPreview", ""] },
                        regex: search as string,
                        options: "i",
                      },
                    },
                  ],
                },
              }
            : true,
        },
      },
      // Filter: Must have at least one received message and match search
      { $match: { hasReceived: true, searchMatch: true } },
    ];

    // 3. Execute List Query
    const emails = await Email.aggregate([
      ...threadingStages,
      { $replaceRoot: { newRoot: "$latestDoc" } },
      { $sort: { receivedDateTime: -1 } },
      { $skip: skip },
      { $limit: limit },
    ]);

    // 4. Execute Count Query
    const countResult = await Email.aggregate([
      ...threadingStages,
      { $count: "total" },
    ]);
    const totalEmails = countResult.length > 0 ? countResult[0].total : 0;

    res.status(200).json({
      success: true,
      data: emails,
      pagination: {
        total: totalEmails,
        page: Number(page),
        limit: limit,
        totalPages: Math.ceil(totalEmails / limit),
      },
    });
  } catch (error: any) {
    console.error("Fetch Received Emails Error:", error);
    res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

export const syncMailboxMessagesByDate = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user || !req.user.email) {
      res.status(401).json({
        success: false,
        message: "User not authenticated or email missing",
      });
      return;
    }

    const email = req.user.email;

    // 1. Get Application Token
    const accessToken = await getAppOnlyToken();

    // 2. Find the latest email date in our DB to perform an incremental sync
    const lastEmail = await Email.findOne({ crmUser: req.user._id }).sort({
      receivedDateTime: -1,
    });

    let filter = "";
    if (lastEmail && lastEmail.receivedDateTime) {
      const lastDate = lastEmail.receivedDateTime.toISOString();
      // Filter for emails received AFTER or AT the last sync time
      filter = `&$filter=receivedDateTime ge ${lastDate}`;
    }

    // 3. Call Graph API for messages (Incremental Sync)
    const graphUrl = `https://graph.microsoft.com/v1.0/users/${email}/messages?$top=200&$orderby=receivedDateTime desc${filter}`;

    const graphResponse = await fetch(graphUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const data = await graphResponse.json();

    if (!graphResponse.ok) {
      res.status(graphResponse.status).json({
        success: false,
        message: "Failed to fetch messages from Microsoft Graph",
        error: data,
      });
      return;
    }

    const messages = data.value || [];

    if (messages.length === 0) {
      res.status(200).json({
        success: true,
        message: `No new messages found for ${email} (Incremental)`,
        count: 0,
      });
      return;
    }

    // 4. Process Inline Attachments (CIDs)
    await Promise.all(
      messages.map((msg: any) =>
        processMessageAttachments(accessToken, email, msg),
      ),
    );

    // 5. Prepare Bulk Operations to avoid duplicates using graphId
    const ops = messages.map((msg: any) => ({
      updateOne: {
        filter: { graphId: msg.id },
        update: {
          $set: {
            graphId: msg.id,
            sender: msg.sender?.emailAddress,
            from: msg.from?.emailAddress,
            toRecipients:
              msg.toRecipients?.map((r: any) => r.emailAddress) || [],
            ccRecipients:
              msg.ccRecipients?.map((r: any) => r.emailAddress) || [],
            bccRecipients:
              msg.bccRecipients?.map((r: any) => r.emailAddress) || [],
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
            crmUser: req.user?._id,
          },
        },
        upsert: true,
      },
    }));

    // 5. Execute Bulk Write
    const result = await Email.bulkWrite(ops);

    res.status(200).json({
      success: true,
      message: `Successfully synced messages for ${email} (Incremental)`,
      stats: {
        totalSynced: messages.length,
        newlyAdded: result.upsertedCount,
        updated: result.modifiedCount,
      },
    });
  } catch (error: any) {
    console.error("Incremental Sync Mailbox Error:", error);
    res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

export const syncMailboxMessages = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user || !req.user.email) {
      res.status(401).json({
        success: false,
        message: "User not authenticated or email missing",
      });
      return;
    }

    const email = req.user.email;

    // 1. Get Application Token
    const accessToken = await getAppOnlyToken();

    // 2. Call Graph API for messages
    // Limiting to top 50 for now
    const graphResponse = await fetch(
      `https://graph.microsoft.com/v1.0/users/${email}/messages?$top=200`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );

    const data = await graphResponse.json();

    if (!graphResponse.ok) {
      res.status(graphResponse.status).json({
        success: false,
        message: "Failed to fetch messages from Microsoft Graph",
        error: data,
      });
      return;
    }

    const messages = data.value || [];

    if (messages.length === 0) {
      res.status(200).json({
        success: true,
        message: `No new messages found for ${email}`,
        count: 0,
      });
      return;
    }

    // 3. Process Inline Attachments (CIDs)
    await Promise.all(
      messages.map((msg: any) =>
        processMessageAttachments(accessToken, email, msg),
      ),
    );

    // 4. Prepare Bulk Operations to avoid duplicates using graphId
    const ops = messages.map((msg: any) => ({
      updateOne: {
        filter: { graphId: msg.id },
        update: {
          $set: {
            graphId: msg.id,
            sender: msg.sender?.emailAddress,
            from: msg.from?.emailAddress,
            toRecipients:
              msg.toRecipients?.map((r: any) => r.emailAddress) || [],
            ccRecipients:
              msg.ccRecipients?.map((r: any) => r.emailAddress) || [],
            bccRecipients:
              msg.bccRecipients?.map((r: any) => r.emailAddress) || [],
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
            crmUser: req.user?._id,
          },
        },
        upsert: true,
      },
    }));

    // 4. Execute Bulk Write
    const result = await Email.bulkWrite(ops);

    res.status(200).json({
      success: true,
      message: `Successfully synced messages for ${email}`,
      stats: {
        totalSynced: messages.length,
        newlyAdded: result.upsertedCount,
        updated: result.modifiedCount,
      },
    });
  } catch (error: any) {
    console.error("Sync Mailbox Error:", error);
    res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

export const replyToMessage = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const { messageId, comment } = req.body;
    const fromEmail = req.user?.email;

    if (!fromEmail || !messageId || !comment) {
      res.status(400).json({
        success: false,
        message: "Missing required fields (messageId, comment) or user email",
      });
      return;
    }

    // 1. Get Application Token
    const accessToken = await getAppOnlyToken();

    // 2. Prepare the Payload
    const payload = {
      comment: comment,
    };

    // 3. Call Graph API to reply
    const graphResponse = await fetch(
      `https://graph.microsoft.com/v1.0/users/${fromEmail}/messages/${messageId}/reply`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      },
    );

    if (!graphResponse.ok) {
      const errorData = await graphResponse.json();
      res.status(graphResponse.status).json({
        success: false,
        message: "Failed to reply to email",
        error: errorData,
      });
      return;
    }

    // Microsoft Graph reply action returns 202 Accepted on success with no body
    res.status(200).json({
      success: true,
      message: `Reply sent successfully from ${fromEmail}`,
    });
  } catch (error: any) {
    console.error("App-Only Reply Mail Error:", error);
    res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};
