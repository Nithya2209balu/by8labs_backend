const imaps = require('imap-simple');
const simpleParser = require('mailparser').simpleParser;

// Timeout wrapper for IMAP operations
const withTimeout = (promise, timeoutMs, operation) => {
    return Promise.race([
        promise,
        new Promise((_, reject) =>
            setTimeout(() => reject(new Error(`${operation} timed out after ${timeoutMs}ms`)), timeoutMs)
        )
    ]);
};

const getInboxEmails = async (userConfig, limit = 20) => {
    let connection = null;
    try {
        // Use user config if provided, otherwise fallback to env (legacy support)
        const imapConfig = {
            imap: {
                user: userConfig?.email || process.env.IMAP_USER,
                password: userConfig?.password || process.env.IMAP_PASSWORD,
                host: userConfig?.imapHost || process.env.IMAP_HOST || 'imap.hostinger.com',
                port: userConfig?.imapPort || process.env.IMAP_PORT || 993,
                tls: true,
                authTimeout: 15000,
                connTimeout: 15000
            }
        };

        console.log(`[IMAP] Connecting to ${imapConfig.imap.user}@${imapConfig.imap.host}:${imapConfig.imap.port}...`);

        // Add timeout for connection (20 seconds)
        connection = await withTimeout(
            imaps.connect(imapConfig),
            20000,
            'IMAP connection'
        );

        console.log('[IMAP] Connected successfully. Opening INBOX...');

        // Add timeout for opening mailbox (10 seconds)
        await withTimeout(
            connection.openBox('INBOX'),
            10000,
            'INBOX open'
        );

        console.log('[IMAP] INBOX opened. Fetching emails...');

        // First, get the total number of messages and calculate UID range
        const boxInfo = await connection.openBox('INBOX');
        const totalMessages = boxInfo.messages.total;
        console.log(`[IMAP] Total messages in inbox: ${totalMessages}`);

        // Optimize: Only fetch recent emails using UID range
        // This is much faster than fetching ALL messages
        const startSeq = Math.max(1, totalMessages - 49); // Fetch last 50 messages
        const endSeq = totalMessages;

        const searchCriteria = [`${startSeq}:${endSeq}`]; // Fetch by sequence number range
        const fetchOptions = {
            bodies: ['HEADER.FIELDS (FROM TO SUBJECT DATE)'], // Only fetch headers, not full bodies
            markSeen: false,
            struct: true
        };

        console.log(`[IMAP] Fetching messages ${startSeq} to ${endSeq}...`);

        // Add timeout for search operation (30 seconds)
        const messages = await withTimeout(
            connection.search(searchCriteria, fetchOptions),
            30000,
            'Email search'
        );

        console.log(`[IMAP] Found ${messages.length} messages. Processing...`);

        // Sort by date (descending) and take the latest 'limit' emails
        const sortedMessages = messages.sort((a, b) => {
            const dateA = a.attributes.date || new Date(0);
            const dateB = b.attributes.date || new Date(0);
            return new Date(dateB) - new Date(dateA);
        }).slice(0, limit);

        console.log(`[IMAP] Parsing ${sortedMessages.length} emails...`);

        const parsedEmails = sortedMessages.map((message) => {
            const id = message.attributes.uid;
            const seen = message.attributes.flags.includes('\\Seen');

            // Parse header fields
            const headerPart = message.parts.find(part => part.which === 'HEADER.FIELDS (FROM TO SUBJECT DATE)');
            const headers = headerPart ? headerPart.body : {};

            // Extract basic info from headers
            const subject = headers.subject ? headers.subject[0] : '(No Subject)';
            const from = headers.from ? headers.from[0] : 'Unknown';
            const date = headers.date ? new Date(headers.date[0]) : message.attributes.date || new Date();

            return {
                id: id,
                subject: subject,
                from: from,
                date: date,
                preview: `${subject.substring(0, 50)}...`, // Use subject as preview for now
                seen: seen
            };
        });

        console.log(`[IMAP] Successfully parsed ${parsedEmails.length} emails. Closing connection...`);
        connection.end();
        return parsedEmails;
    } catch (error) {
        console.error('[IMAP] Error:', error.message);
        console.error('[IMAP] Error details:', error);

        // Ensure connection is closed
        if (connection) {
            try {
                connection.end();
            } catch (closeError) {
                console.error('[IMAP] Error closing connection:', closeError);
            }
        }

        // Provide more helpful error messages
        if (error.message.includes('timed out')) {
            throw new Error(`IMAP operation timed out: ${error.message}. Check your internet connection and IMAP server status.`);
        } else if (error.message.includes('ENOTFOUND') || error.message.includes('ECONNREFUSED')) {
            throw new Error('Cannot connect to IMAP server. Please check your host and port settings.');
        } else if (error.message.includes('Invalid credentials') || error.message.includes('AUTHENTICATIONFAILED')) {
            throw new Error('Invalid email credentials. Please check your email and password.');
        } else {
            throw error;
        }
    }
};

const getEmailContent = async (userConfig, uid) => {
    let connection = null;
    try {
        const imapConfig = {
            imap: {
                user: userConfig?.email || process.env.IMAP_USER,
                password: userConfig?.password || process.env.IMAP_PASSWORD,
                host: userConfig?.imapHost || process.env.IMAP_HOST || 'imap.hostinger.com',
                port: userConfig?.imapPort || process.env.IMAP_PORT || 993,
                tls: true,
                authTimeout: 15000,
                connTimeout: 15000
            }
        };

        console.log(`[IMAP] Fetching email UID ${uid}...`);

        connection = await withTimeout(
            imaps.connect(imapConfig),
            20000,
            'IMAP connection'
        );

        await withTimeout(
            connection.openBox('INBOX'),
            10000,
            'INBOX open'
        );

        const searchCriteria = [['UID', uid]];
        const fetchOptions = {
            bodies: [''],
            markSeen: true // Mark as read when opened
        };

        const messages = await withTimeout(
            connection.search(searchCriteria, fetchOptions),
            20000,
            'Email fetch'
        );

        if (!messages.length) {
            connection.end();
            return null;
        }

        const message = messages[0];
        const all = message.parts.find(part => part.which === '');
        const parsed = await simpleParser(all.body);

        console.log(`[IMAP] Email UID ${uid} fetched successfully.`);
        connection.end();

        return {
            id: uid,
            subject: parsed.subject,
            from: parsed.from.text,
            to: parsed.to.text,
            cc: parsed.cc ? parsed.cc.text : '',
            date: parsed.date,
            html: parsed.html || parsed.textAsHtml || parsed.text,
            text: parsed.text,
            attachments: parsed.attachments
        };
    } catch (error) {
        console.error('[IMAP] Error fetching email:', error.message);

        // Ensure connection is closed
        if (connection) {
            try {
                connection.end();
            } catch (closeError) {
                console.error('[IMAP] Error closing connection:', closeError);
            }
        }

        // Provide more helpful error messages
        if (error.message.includes('timed out')) {
            throw new Error(`IMAP operation timed out: ${error.message}`);
        } else if (error.message.includes('ENOTFOUND') || error.message.includes('ECONNREFUSED')) {
            throw new Error('Cannot connect to IMAP server. Please check your settings.');
        } else if (error.message.includes('Invalid credentials') || error.message.includes('AUTHENTICATIONFAILED')) {
            throw new Error('Invalid email credentials.');
        } else {
            throw error;
        }
    }
};

module.exports = {
    getInboxEmails,
    getEmailContent
};
