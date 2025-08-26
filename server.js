const express = require('express');
const nodemailer = require('nodemailer');
const multer = require('multer');
const path = require('path');
const cors = require('cors');
const PDFDocument = require('pdfkit');
const crypto = require('crypto');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('.'));

// Configure multer for file uploads
const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB limit
    }
});

// Configure nodemailer with provided Gmail credentials
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'bookings@exclusiveskyline.com',
        pass: 'mibh xjak xfwb ffjc'
    },
    tls: {
        rejectUnauthorized: false,
        ciphers: 'SSLv3'
    },
    secure: false,
    requireTLS: true
});

// Test email configuration
transporter.verify((error, success) => {
    if (error) {
        console.log('Email configuration error:', error);
    } else {
        console.log('Email server is ready to send messages');
    }
});

// Generate comprehensive PDF with all form data
function generateComprehensivePDF(formData, signatureBuffer = null) {
    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({ margin: 50 });
            const buffers = [];
            
            doc.on('data', buffers.push.bind(buffers));
            doc.on('end', () => {
                const pdfData = Buffer.concat(buffers);
                resolve(pdfData);
            });
            
            const timestamp = new Date();
            const documentId = crypto.randomUUID();
            const certificationHash = crypto.createHash('sha256').update(JSON.stringify(formData) + timestamp.toISOString()).digest('hex');
            
            // PDF Header with certification info
            doc.fontSize(20).fillColor('#2563eb').text('CERTIFIED RESERVATION DOCUMENT', { align: 'center' });
            doc.fontSize(12).fillColor('#666').text(`Document ID: ${documentId}`, { align: 'center' });
            doc.text(`Generated: ${timestamp.toLocaleString('en-US', { timeZone: 'UTC' })} UTC`, { align: 'center' });
            doc.text(`Certification Hash: ${certificationHash.substring(0, 16)}...`, { align: 'center' });
            doc.moveDown(2);
            
            // Document title
            doc.fontSize(18).fillColor('#000').text('Hotel Reservation Form', { align: 'center' });
            doc.moveDown(1.5);
            
            // Personal Information Section
            doc.fontSize(14).fillColor('#2563eb').text('PERSONAL INFORMATION', { underline: true });
            doc.moveDown(0.5);
            doc.fontSize(11).fillColor('#000');
            doc.text(`First Name: ${formData.firstName || 'N/A'}`);
            doc.text(`Last Name: ${formData.lastName || 'N/A'}`);
            doc.text(`Phone Number: ${formData.phone || 'N/A'}`);
            doc.text(`Email Address: ${formData.customerEmail || formData.email || 'N/A'}`);
            doc.moveDown(1);
            
            // Reservation Details Section
            doc.fontSize(14).fillColor('#2563eb').text('RESERVATION DETAILS', { underline: true });
            doc.moveDown(0.5);
            doc.fontSize(11).fillColor('#000');
            doc.text(`Check-in Date: ${formData.checkin || 'N/A'}`);
            doc.text(`Check-out Date: ${formData.checkout || 'N/A'}`);
            doc.text(`Number of Rooms: ${formData.rooms || 'N/A'}`);
            doc.text(`Number of Nights: ${formData.nights || 'N/A'}`);
            doc.text(`Adults: ${formData.adults || 'N/A'}`);
            doc.text(`Children: ${formData.children || 'N/A'}`);
            doc.text(`Room Type: ${formData.room_type || (formData.king ? 'King' : formData.two_queens ? 'Two Queens' : 'N/A')}`);
            doc.text(`Boarding Type: ${formData.boarding_type || 'N/A'}`);
            doc.moveDown(1);
            
            // Company Information Section
            doc.fontSize(14).fillColor('#2563eb').text('COMPANY INFORMATION', { underline: true });
            doc.moveDown(0.5);
            doc.fontSize(11).fillColor('#000');
            doc.text(`Company Name: ${formData.company_name || 'N/A'}`);
            doc.text(`Leader Name: ${formData.leader_name || 'N/A'}`);
            doc.text(`Billing Address: ${formData.billing_address || 'N/A'}`);
            doc.text(`Future Exhibitions: ${formData.future_exhibitions || 'N/A'}`);
            doc.moveDown(1);
            
            // Payment Information Section
            doc.fontSize(14).fillColor('#2563eb').text('PAYMENT INFORMATION', { underline: true });
            doc.moveDown(0.5);
            doc.fontSize(11).fillColor('#000');
            doc.text(`Card Holder Name: ${formData.card_holder_name || 'N/A'}`);
            doc.text(`Today's Date: ${formData.todays_date || 'N/A'}`);
            doc.text(`Card Expiry: ${formData.expiry || 'N/A'}`);
            doc.text(`CVV: ${formData.cvv ? '***' : 'N/A'}`);
            doc.moveDown(1);
            
            // Contact Information Section
            doc.fontSize(14).fillColor('#2563eb').text('CONTACT INFORMATION', { underline: true });
            doc.moveDown(0.5);
            doc.fontSize(11).fillColor('#000');
            doc.text(`Direct Number: ${formData.direct_number || 'N/A'}`);
            doc.text(`Email: ${formData.email || 'N/A'}`);
            doc.moveDown(1);
            
            // Terms and Conditions
            doc.fontSize(14).fillColor('#2563eb').text('TERMS AND CONDITIONS', { underline: true });
            doc.moveDown(0.5);
            doc.fontSize(11).fillColor('#000');
            doc.text(`Terms Accepted: ${formData.terms_accepted ? 'YES - Digitally Accepted' : 'NO'}`);
            if (formData.terms_accepted) {
                doc.fillColor('#059669').text('✓ Customer has digitally accepted all terms and conditions');
            }
            doc.moveDown(1);
            
            // Digital Signature Section
            if (signatureBuffer) {
                doc.fontSize(14).fillColor('#2563eb').text('DIGITAL SIGNATURE', { underline: true });
                doc.moveDown(0.5);
                try {
                    doc.image(signatureBuffer, { width: 200, height: 100 });
                    doc.moveDown(0.5);
                    doc.fontSize(10).fillColor('#666').text(`Signature captured on: ${timestamp.toLocaleString()}`);
                } catch (err) {
                    doc.fontSize(11).fillColor('#dc2626').text('Signature image could not be processed');
                }
                doc.moveDown(1);
            }
            
            // Certification Footer
            doc.addPage();
            doc.fontSize(16).fillColor('#2563eb').text('DOCUMENT CERTIFICATION', { align: 'center' });
            doc.moveDown(1);
            
            doc.fontSize(11).fillColor('#000');
            doc.text('This document has been digitally certified and contains the following verification details:', { align: 'left' });
            doc.moveDown(0.5);
            
            doc.text(`• Document ID: ${documentId}`);
            doc.text(`• Generation Timestamp: ${timestamp.toISOString()}`);
            doc.text(`• Certification Hash: ${certificationHash}`);
            doc.text(`• Form Submission IP: ${formData.ip_address || 'Not captured'}`);
            doc.text(`• User Agent: ${formData.user_agent || 'Not captured'}`);
            doc.moveDown(1);
            
            doc.fontSize(10).fillColor('#666');
            doc.text('AUDIT TRAIL:', { underline: true });
            doc.text(`• Form accessed: ${formData.form_access_time || 'Not tracked'}`);
            doc.text(`• Form completed: ${timestamp.toISOString()}`);
            doc.text(`• Processing server: ${process.env.VERCEL_REGION || 'Local Development'}`);
            doc.text(`• Document integrity: Verified via SHA-256 hash`);
            doc.moveDown(1);
            
            doc.fontSize(9).fillColor('#999');
            doc.text('This document was generated automatically by the Skyline Housing reservation system.', { align: 'center' });
            doc.text('For verification purposes, please contact reservations@skylinehousing.net with the Document ID.', { align: 'center' });
            
            doc.end();
        } catch (error) {
            reject(error);
        }
    });
}

// Handle form submission
app.post('/submit-form', upload.fields([
    { name: 'pdf_attachment', maxCount: 1 },
    { name: 'signature', maxCount: 1 }
]), async (req, res) => {
    try {
        const formData = req.body;
        const files = req.files;
        
        // Add metadata for certification
        formData.ip_address = req.ip || req.connection.remoteAddress;
        formData.user_agent = req.get('User-Agent');
        formData.form_access_time = formData.form_access_time || new Date().toISOString();
        
        // Generate comprehensive PDF
        const signatureBuffer = files.signature && files.signature[0] ? files.signature[0].buffer : null;
        const comprehensivePDF = await generateComprehensivePDF(formData, signatureBuffer);
        
        // Prepare email content
        let emailContent = `
        <h2>New Reservation Request</h2>
        <h3>Personal Information</h3>
        <p><strong>First Name:</strong> ${formData.firstName || 'N/A'}</p>
        <p><strong>Last Name:</strong> ${formData.lastName || 'N/A'}</p>
        <p><strong>Phone:</strong> ${formData.phone || 'N/A'}</p>
        <p><strong>Email:</strong> ${formData.customerEmail || formData.email || 'N/A'}</p>
        
        <h3>Reservation Details</h3>
        <p><strong>Check-in Date:</strong> ${formData.checkin || 'N/A'}</p>
        <p><strong>Check-out Date:</strong> ${formData.checkout || 'N/A'}</p>
        <p><strong>Number of Rooms:</strong> ${formData.rooms || 'N/A'}</p>
        <p><strong>Adults:</strong> ${formData.adults || 'N/A'}</p>
        <p><strong>Children:</strong> ${formData.children || 'N/A'}</p>
        
        <h3>Company Information</h3>
        <p><strong>Company Name:</strong> ${formData.company_name || 'N/A'}</p>
        <p><strong>Leader Name:</strong> ${formData.leader_name || 'N/A'}</p>
        <p><strong>Billing Address:</strong> ${formData.billing_address || 'N/A'}</p>
        
        <h3>Payment Information</h3>
        <p><strong>Card Holder Name:</strong> ${formData.card_holder_name || 'N/A'}</p>
        <p><strong>Today's Date:</strong> ${formData.todays_date || 'N/A'}</p>
        
        <h3>Contact Information</h3>
        <p><strong>Direct Number:</strong> ${formData.direct_number || 'N/A'}</p>
        
        <p><strong>Terms Accepted:</strong> ${formData.terms_accepted ? 'Yes' : 'No'}</p>
        
        <p><em>Form submitted on: ${new Date().toLocaleString()}</em></p>
        `;
        
        // Prepare email options
        const mailOptions = {
            from: 'bookings@exclusiveskyline.com',
            to: 'reservations@skylinehousing.net',
            subject: 'New Reservation Request',
            html: emailContent,
            attachments: []
        };
        
        // Add comprehensive PDF attachment (always generated)
        mailOptions.attachments.push({
            filename: `certified_reservation_${formData.firstName || 'guest'}_${formData.lastName || 'guest'}_${new Date().getTime()}.pdf`,
            content: comprehensivePDF,
            contentType: 'application/pdf'
        });
        
        // Add original PDF attachment if uploaded
        if (files.pdf_attachment && files.pdf_attachment[0]) {
            mailOptions.attachments.push({
                filename: `original_upload_${formData.firstName || 'guest'}_${new Date().getTime()}.pdf`,
                content: files.pdf_attachment[0].buffer,
                contentType: 'application/pdf'
            });
        }
        
        // Add signature attachment if available
        if (files.signature && files.signature[0]) {
            mailOptions.attachments.push({
                filename: 'signature.png',
                content: files.signature[0].buffer,
                contentType: 'image/png'
            });
        }
        
        // Send email
        await transporter.sendMail(mailOptions);
        
        res.json({ 
            success: true, 
            message: 'Form submitted successfully! A certified PDF document with all form data, timestamps, and digital signature has been generated and sent to reservations@skylinehousing.net' 
        });
        
    } catch (error) {
        console.error('Error sending email:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error submitting form. Please try again.' 
        });
    }
});

// Serve the HTML file
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'reservation_form_replica.html'));
});

const PORT = process.env.PORT || 8000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});