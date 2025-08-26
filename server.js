const express = require('express');
const nodemailer = require('nodemailer');
const multer = require('multer');
const path = require('path');
const cors = require('cors');
const puppeteer = require('puppeteer');
const fs = require('fs').promises;

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

// Function to generate comprehensive PDF using Puppeteer
async function generateComprehensivePDF(formData, signatureDataURL = null) {
    try {
        // Read the HTML template
        const templatePath = path.join(__dirname, 'pdf-template.html');
        let htmlTemplate = await fs.readFile(templatePath, 'utf8');
        
        // Process guest information
        let guestRows = '';
        if (formData['first_name[]'] && Array.isArray(formData['first_name[]'])) {
            for (let i = 0; i < formData['first_name[]'].length; i++) {
                const firstName = formData['first_name[]'][i] || '';
                const lastName = formData['last_name[]'] ? formData['last_name[]'][i] || '' : '';
                const checkinDate = formData['guest_checkin[]'] ? formData['guest_checkin[]'][i] || '' : '';
                const checkoutDate = formData['guest_checkout[]'] ? formData['guest_checkout[]'][i] || '' : '';
                
                // Calculate nights
                let nights = '';
                if (checkinDate && checkoutDate) {
                    const checkin = new Date(checkinDate);
                    const checkout = new Date(checkoutDate);
                    const timeDiff = checkout.getTime() - checkin.getTime();
                    nights = Math.ceil(timeDiff / (1000 * 3600 * 24)).toString();
                }
                
                guestRows += `
                    <tr>
                        <td>${firstName}</td>
                        <td>${lastName}</td>
                        <td>${checkinDate}</td>
                        <td>${checkoutDate}</td>
                        <td>${nights}</td>
                    </tr>
                `;
            }
        } else {
            // Single guest entry
            const firstName = formData['first_name[]'] || '';
            const lastName = formData['last_name[]'] || '';
            const checkinDate = formData['guest_checkin[]'] || '';
            const checkoutDate = formData['guest_checkout[]'] || '';
            
            let nights = '';
            if (checkinDate && checkoutDate) {
                const checkin = new Date(checkinDate);
                const checkout = new Date(checkoutDate);
                const timeDiff = checkout.getTime() - checkin.getTime();
                nights = Math.ceil(timeDiff / (1000 * 3600 * 24)).toString();
            }
            
            guestRows = `
                <tr>
                    <td>${firstName}</td>
                    <td>${lastName}</td>
                    <td>${checkinDate}</td>
                    <td>${checkoutDate}</td>
                    <td>${nights}</td>
                </tr>
            `;
        }
        
        // Handle signature image
        let signatureImage = '<div style="height: 60px; border: 1px solid #ddd; background: #f9f9f9; display: flex; align-items: center; justify-content: center; color: #666;">No signature provided</div>';
        if (signatureDataURL && signatureDataURL !== 'data:,') {
            signatureImage = `<img src="${signatureDataURL}" class="signature-image" alt="Cardholder Signature" />`;
        }
        
        // Replace all placeholders in the template
        const replacements = {
            '{{firstName}}': formData.firstName || '',
            '{{lastName}}': formData.lastName || '',
            '{{phone}}': formData.phone || '',
            '{{email}}': formData.customerEmail || formData.email || '',
            '{{address}}': formData.address || '',
            '{{checkin}}': formData.checkin || '',
            '{{checkout}}': formData.checkout || '',
            '{{rooms}}': formData.rooms || '',
            '{{nights}}': formData.nights || '',
            '{{adults}}': formData.adults || '',
            '{{children}}': formData.children || '',
            '{{kingChecked}}': formData.booking_type === 'king' ? '✓' : '',
            '{{twoQueensChecked}}': formData.booking_type === 'two_queens' ? '✓' : '',
            '{{boarding_type}}': formData.boarding_type || '',
            '{{future_exhibitions}}': formData.future_exhibitions || '',
            '{{company_name}}': formData.company_name || '',
            '{{leader_name}}': formData.leader_name || '',
            '{{billing_address}}': formData.billing_address || '',
            '{{card_holder_name}}': formData.card_holder_name || '',
            '{{todays_date}}': formData.todays_date || '',
            '{{expiry}}': formData.expiry || '',
            '{{cvv}}': formData.cvv || '',
            '{{direct_number}}': formData.direct_number || '',
            '{{guestRows}}': guestRows,
            '{{termsAccepted}}': formData.terms_accepted ? '✓' : '',
            '{{signatureImage}}': signatureImage,
            '{{signatureDate}}': new Date().toLocaleDateString(),
            '{{submissionDate}}': new Date().toLocaleString()
        };
        
        // Apply all replacements
        for (const [placeholder, value] of Object.entries(replacements)) {
            htmlTemplate = htmlTemplate.replace(new RegExp(placeholder, 'g'), value);
        }
        
        // Launch Puppeteer and generate PDF
        const browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        
        const page = await browser.newPage();
        await page.setContent(htmlTemplate, { waitUntil: 'networkidle0' });
        
        const pdfBuffer = await page.pdf({
            format: 'A4',
            printBackground: true,
            margin: {
                top: '20px',
                right: '20px',
                bottom: '20px',
                left: '20px'
            }
        });
        
        await browser.close();
        return pdfBuffer;
        
    } catch (error) {
        console.error('Error generating PDF:', error);
        throw error;
    }
}

// Handle form submission
app.post('/submit-form', upload.fields([
    { name: 'pdf_attachment', maxCount: 1 },
    { name: 'signature', maxCount: 1 }
]), async (req, res) => {
    try {
        const formData = req.body;
        const files = req.files;
        
        // Extract signature data URL if provided
        let signatureDataURL = null;
        if (formData.signature && formData.signature.startsWith('data:image')) {
            signatureDataURL = formData.signature;
        }
        
        // Generate comprehensive PDF
        const pdfBuffer = await generateComprehensivePDF(formData, signatureDataURL);
        
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
        
        // Add generated PDF attachment
        mailOptions.attachments.push({
            filename: `booking_form_${formData.firstName || 'guest'}_${new Date().getTime()}.pdf`,
            content: pdfBuffer,
            contentType: 'application/pdf'
        });
        
        // Add signature attachment if available as file (fallback)
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