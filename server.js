const express = require('express');
const nodemailer = require('nodemailer');
const multer = require('multer');
const path = require('path');
const cors = require('cors');

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

// Handle form submission
app.post('/submit-form', upload.fields([
    { name: 'pdf_attachment', maxCount: 1 },
    { name: 'signature', maxCount: 1 }
]), async (req, res) => {
    try {
        const formData = req.body;
        const files = req.files;
        
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
        
        // Add PDF attachment if available
        if (files.pdf_attachment && files.pdf_attachment[0]) {
            mailOptions.attachments.push({
                filename: `booking_form_${formData.firstName || 'guest'}_${new Date().getTime()}.pdf`,
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
            message: 'Form submitted successfully! A copy with PDF attachment has been sent to reservations@skylinehousing.net' 
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