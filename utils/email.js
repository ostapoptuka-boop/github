const nodemailer = require('nodemailer');

let transporter = null;

function getTransporter() {
    if (!transporter) {
        transporter = nodemailer.createTransport({
            host: process.env.EMAIL_HOST || 'smtp.gmail.com',
            port: parseInt(process.env.EMAIL_PORT) || 587,
            secure: false,
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS
            }
        });
    }
    return transporter;
}

async function sendVerificationEmail(email, token, name) {
    const verifyUrl = (process.env.FRONTEND_URL || 'http://localhost:3000') + '/api/auth/verify-email/' + token;

    const mailOptions = {
        from: '"TrustDrop" <' + (process.env.EMAIL_USER || 'noreply@trustdrop.com') + '>',
        to: email,
        subject: 'Подтвердите email — TrustDrop',
        html: `
            <div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto;background:#0f172a;color:#fff;border-radius:16px;overflow:hidden;">
                <div style="background:linear-gradient(135deg,#2563eb,#6366f1);padding:30px;text-align:center;">
                    <h1 style="margin:0;font-size:28px;letter-spacing:2px;">TRUSTDROP</h1>
                </div>
                <div style="padding:30px;">
                    <p style="font-size:16px;">Привет, <strong>${name}</strong>!</p>
                    <p style="color:#94a3b8;">Спасибо за регистрацию. Нажмите кнопку ниже для подтверждения email:</p>
                    <div style="text-align:center;margin:30px 0;">
                        <a href="${verifyUrl}" style="background:linear-gradient(135deg,#2563eb,#4f46e5);color:#fff;padding:14px 40px;border-radius:12px;text-decoration:none;font-weight:700;font-size:16px;display:inline-block;">
                            Подтвердить Email
                        </a>
                    </div>
                    <p style="color:#64748b;font-size:13px;">Ссылка действительна 24 часа.</p>
                    <hr style="border:1px solid #1e293b;margin:20px 0;">
                    <p style="color:#475569;font-size:12px;">Если вы не регистрировались — просто проигнорируйте это письмо.</p>
                </div>
            </div>
        `
    };

    await getTransporter().sendMail(mailOptions);
}

module.exports = { sendVerificationEmail };
