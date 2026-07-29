import nodemailer from "nodemailer";

export interface SmtpConfigStatus {
  isConfigured: boolean;
  host: string;
  port: number;
  secure: boolean;
  user: string;
  fromName: string;
  fromEmail: string;
  appBaseUrl: string;
}

export function getSmtpConfigStatus(): SmtpConfigStatus {
  const host = process.env.SMTP_HOST || "";
  const port = parseInt(process.env.SMTP_PORT || "587", 10);
  const secure = process.env.SMTP_SECURE === "true" || port === 465;
  const user = process.env.SMTP_USER || "";
  const pass = process.env.SMTP_PASSWORD || "";
  const fromName = process.env.SMTP_FROM_NAME || "PK SIG Assistência";
  const fromEmail = process.env.SMTP_FROM_EMAIL || user || "no-reply@pksig.com";
  const appBaseUrl = (process.env.APP_BASE_URL || process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");

  const isConfigured = Boolean(host && user && pass);

  return {
    isConfigured,
    host,
    port,
    secure,
    user,
    fromName,
    fromEmail,
    appBaseUrl,
  };
}

export function createTransporter() {
  const config = getSmtpConfigStatus();
  if (!config.isConfigured) {
    throw new Error("Serviço de e-mail SMTP não está totalmente configurado nas variáveis de ambiente.");
  }

  return nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: {
      user: config.user,
      pass: process.env.SMTP_PASSWORD || "",
    },
    tls: {
      rejectUnauthorized: false, // Prevents self-signed cert issues in dev
    },
  });
}

export async function testSmtpConnection(targetEmail: string): Promise<{ success: boolean; message: string }> {
  try {
    const config = getSmtpConfigStatus();
    if (!config.isConfigured) {
      return {
        success: false,
        message: "SMTP não configurado. Defina SMTP_HOST, SMTP_USER e SMTP_PASSWORD no .env.",
      };
    }

    const transporter = createTransporter();
    await transporter.verify();

    const info = await transporter.sendMail({
      from: `"${config.fromName}" <${config.fromEmail}>`,
      to: targetEmail,
      subject: "PK SIG - Teste de Configuração de E-mail SMTP",
      text: `Olá!\n\nEste é um e-mail de teste enviado pelo sistema PK SIG para confirmar que suas configurações de SMTP estão funcionando corretamente.\n\nData: ${new Date().toLocaleString("pt-BR")}\nHost: ${config.host}:${config.port}\n\nAtenciosamente,\nPK SIG Gestão`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; rounded-radius: 8px;">
          <h2 style="color: #0e131f; margin-top: 0;">PK SIG - Teste de E-mail SMTP</h2>
          <p style="color: #374151;">Olá!</p>
          <p style="color: #374151;">Este é um e-mail de teste enviado pelo sistema <strong>PK SIG</strong> para confirmar que suas configurações de servidor SMTP estão operando com sucesso.</p>
          <div style="background-color: #f3f4f6; padding: 12px; border-radius: 6px; font-size: 13px; color: #4b5563; margin: 20px 0;">
            <strong>Detalhes do Envio:</strong><br/>
            • Host: ${config.host}:${config.port}<br/>
            • Remetente: ${config.fromName} (${config.fromEmail})<br/>
            • Data/Hora: ${new Date().toLocaleString("pt-BR")}
          </div>
          <p style="color: #6b7280; font-size: 12px;">Se você não solicitou este teste, por favor desconsidere.</p>
        </div>
      `,
    });

    return {
      success: true,
      message: `E-mail de teste enviado com sucesso para ${targetEmail}! Message ID: ${info.messageId}`,
    };
  } catch (err: any) {
    console.error("Test SMTP error:", err);
    return {
      success: false,
      message: `Falha ao enviar e-mail de teste: ${err.message || err}`,
    };
  }
}

export async function sendPasswordResetEmail(
  toEmail: string,
  adminName: string,
  resetUrl: string
): Promise<{ success: boolean; message: string }> {
  try {
    const config = getSmtpConfigStatus();
    if (!config.isConfigured) {
      console.warn("SMTP not configured. Password reset email skipped.");
      return {
        success: false,
        message: "Servidor SMTP não configurado. Verifique as variáveis de ambiente.",
      };
    }

    const transporter = createTransporter();

    const subject = "PK SIG - Instruções para Redefinição de Senha";
    const textBody = `Olá, ${adminName}!\n\nRecebemos uma solicitação para redefinir a senha da sua conta de administrador no sistema PK SIG.\n\nPara cadastrar uma nova senha, acesse o link abaixo (válido por 30 minutos):\n${resetUrl}\n\nSe você não solicitou a redefinição de senha, ignore este e-mail. Nenhuma alteração foi realizada.\n\nAtenciosamente,\nEquipe PK SIG`;

    const htmlBody = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e5e7eb; border-radius: 8px; background-color: #ffffff;">
        <div style="background-color: #0e131f; padding: 16px; border-radius: 6px 6px 0 0; text-align: center;">
          <h1 style="color: #ffffff; font-size: 20px; margin: 0; font-weight: bold;">PK SIG</h1>
          <p style="color: #9ca3af; font-size: 12px; margin: 4px 0 0 0;">Gestão de Assistência Técnica</p>
        </div>
        <div style="padding: 24px 16px;">
          <h2 style="color: #111827; font-size: 16px; margin-top: 0;">Recuperação de Senha</h2>
          <p style="color: #374151; font-size: 14px;">Olá, <strong>${adminName}</strong>!</p>
          <p style="color: #374151; font-size: 14px; line-height: 1.5;">
            Recebemos uma solicitação para redefinir a senha da sua conta de administrador no sistema PK SIG.
          </p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetUrl}" style="background-color: #4f46e5; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: bold; font-size: 14px; display: inline-block;">
              Redefinir Minha Senha
            </a>
          </div>
          <p style="color: #6b7280; font-size: 12px; line-height: 1.4;">
            Ou copie e cole o link a seguir no seu navegador:<br/>
            <a href="${resetUrl}" style="color: #4f46e5; word-break: break-all;">${resetUrl}</a>
          </p>
          <div style="background-color: #fef2f2; border-left: 4px solid #ef4444; padding: 12px; margin-top: 20px; font-size: 12px; color: #991b1b;">
            <strong>Atenção:</strong> Este link é válido por <strong>30 minutos</strong>. Se você não solicitou esta redefinição, desconsidere este e-mail.
          </div>
        </div>
        <div style="border-top: 1px solid #f3f4f6; padding-top: 16px; text-align: center; font-size: 11px; color: #9ca3af;">
          © ${new Date().getFullYear()} PK SIG • Este é um e-mail automático.
        </div>
      </div>
    `;

    await transporter.sendMail({
      from: `"${config.fromName}" <${config.fromEmail}>`,
      to: toEmail,
      subject,
      text: textBody,
      html: htmlBody,
    });

    return {
      success: true,
      message: "E-mail de recuperação enviado com sucesso.",
    };
  } catch (err: any) {
    console.error("sendPasswordResetEmail error:", err);
    return {
      success: false,
      message: err.message || "Erro ao enviar e-mail de redefinição.",
    };
  }
}
