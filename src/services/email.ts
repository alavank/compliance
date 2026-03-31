// Serviço de email usando Resend (resend.com - gratuito 100 emails/dia)
// Configure RESEND_API_KEY nas variáveis de ambiente do Railway
// Se não configurar, o sistema funciona normal sem enviar emails

export async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.log('RESEND_API_KEY não configurada. Email não enviado para:', to);
    return false;
  }

  try {
    const fromEmail = process.env.EMAIL_FROM || 'Cofre de Senhas <noreply@cofre.com>';
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + apiKey },
      body: JSON.stringify({ from: fromEmail, to: [to], subject, html }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error('Erro ao enviar email:', err);
      return false;
    }

    console.log('Email enviado para:', to);
    return true;
  } catch (err) {
    console.error('Erro ao enviar email:', err);
    return false;
  }
}

export function buildTermAcceptanceEmail(params: {
  userName: string; cpf: string; hash: string;
  termTitle: string; termVersion: number; termContent: string;
  acceptedAt: string; ipAddress: string;
}): string {
  return `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0c1222; color: #e2e8f0; padding: 32px; border-radius: 16px;">
      <div style="text-align: center; margin-bottom: 24px;">
        <div style="display: inline-block; background: linear-gradient(135deg, #5c7cfa, #4263eb); padding: 16px; border-radius: 16px; margin-bottom: 12px;">
          <span style="font-size: 32px;">🔐</span>
        </div>
        <h1 style="color: #5c7cfa; font-size: 24px; margin: 8px 0;">Cofre de Senhas</h1>
        <p style="color: #64748b; font-size: 14px;">Comprovante de Aceite do Termo</p>
      </div>
      
      <div style="background: rgba(30,41,70,0.6); border: 1px solid rgba(99,102,241,0.15); border-radius: 12px; padding: 20px; margin-bottom: 16px;">
        <h2 style="color: #94a3b8; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 12px;">Dados do Aceite</h2>
        <p style="margin: 6px 0;"><strong style="color: #5c7cfa;">Nome:</strong> ${params.userName}</p>
        <p style="margin: 6px 0;"><strong style="color: #5c7cfa;">CPF:</strong> ${params.cpf}</p>
        <p style="margin: 6px 0;"><strong style="color: #5c7cfa;">Data/Hora:</strong> ${params.acceptedAt}</p>
        <p style="margin: 6px 0;"><strong style="color: #5c7cfa;">IP:</strong> ${params.ipAddress}</p>
        <p style="margin: 6px 0;"><strong style="color: #5c7cfa;">Termo:</strong> ${params.termTitle} (v${params.termVersion})</p>
      </div>

      <div style="background: rgba(30,41,70,0.6); border: 1px solid rgba(99,102,241,0.15); border-radius: 12px; padding: 20px; margin-bottom: 16px;">
        <h2 style="color: #94a3b8; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 12px;">Hash de Verificação (SHA-256)</h2>
        <p style="font-family: 'Courier New', monospace; font-size: 11px; color: #5c7cfa; word-break: break-all; background: rgba(0,0,0,0.3); padding: 12px; border-radius: 8px;">${params.hash}</p>
        <p style="color: #64748b; font-size: 11px; margin-top: 8px;">Este hash garante a integridade do aceite. Qualquer alteração no termo invalida este código.</p>
      </div>

      <div style="background: rgba(30,41,70,0.6); border: 1px solid rgba(99,102,241,0.15); border-radius: 12px; padding: 20px; margin-bottom: 16px; max-height: 300px; overflow-y: auto;">
        <h2 style="color: #94a3b8; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 12px;">Conteúdo do Termo</h2>
        <pre style="font-size: 12px; color: #94a3b8; white-space: pre-wrap; line-height: 1.6; margin: 0;">${params.termContent}</pre>
      </div>

      <div style="text-align: center; padding-top: 16px; border-top: 1px solid rgba(99,102,241,0.15);">
        <p style="color: #64748b; font-size: 11px;">Este é um email automático do sistema Cofre de Senhas.</p>
        <p style="color: #64748b; font-size: 11px;">Guarde este comprovante para seus registros.</p>
      </div>
    </div>
  `;
}
