const nodeMailer = require('nodemailer');

exports.sendEmail = async (options) => {
  var transporter = nodeMailer.createTransport({
    host: 'sandbox.smtp.mailtrap.io',
    port: 2525,
    auth: {
      user: 'ca0f7290d552a2',
      pass: '93478fe16c07a8',
    },
  });
  const mailOptions = {
    from: 'ca0f7290d552a2',
    to: options.email,
    subject: options.subject,
    text: options.message,
  };

  await transporter.sendMail(mailOptions);
};
