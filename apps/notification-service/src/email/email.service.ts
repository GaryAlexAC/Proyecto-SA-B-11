import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly transporter: nodemailer.Transporter;
  private readonly fromEmail: string;
  private readonly isConfigured: boolean;

  constructor() {
    this.fromEmail = process.env.EMAIL_USER || '';
    const appPass = process.env.EMAIL_APP_PASS || '';
    this.isConfigured = !!this.fromEmail && !!appPass;

    if (this.isConfigured) {
      this.transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: this.fromEmail,
          pass: appPass,
        },
      });
      this.logger.log('✅ EmailService configurado con Gmail (Nodemailer)');
    } else {
      this.logger.warn(
        '⚠️  EMAIL_USER o EMAIL_APP_PASS no configurados. ' +
          'Los correos serán simulados en consola.',
      );
    }
  }

  async sendEmail(to: string, subject: string, html: string): Promise<void> {
    if (!this.isConfigured) {
      // Fallback a simulación si no hay credenciales configuradas
      this.logger.log(`\n======================================================`);
      this.logger.log(`📧 SIMULANDO ENVÍO DE CORREO (sin credenciales configuradas)`);
      this.logger.log(`Para: ${to}`);
      this.logger.log(`Asunto: ${subject}`);
      this.logger.log(`Contenido: ${html}`);
      this.logger.log(`======================================================\n`);
      return;
    }

    try {
      const info = await this.transporter.sendMail({
        from: `"Bank USAC" <${this.fromEmail}>`,
        to,
        subject,
        html,
      });
      this.logger.log(`✅ Correo enviado a ${to} | MessageId: ${info.messageId}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`❌ Error al enviar correo a ${to}: ${message}`);
      // No relanzamos el error para no afectar el flujo principal del microservicio
    }
  }

  async sendActivationEmail(to: string, activationLink: string): Promise<void> {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1a73e8;">Bank USAC — Activa tu cuenta</h2>
        <p>Hola, gracias por registrarte en <strong>Bank USAC</strong>.</p>
        <p>Para activar tu cuenta, haz clic en el siguiente botón:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${activationLink}"
             style="background-color: #1a73e8; color: white; padding: 14px 28px;
                    text-decoration: none; border-radius: 6px; font-size: 16px;">
            Activar mi cuenta
          </a>
        </div>
        <p style="color: #666; font-size: 12px;">
          Si no solicitaste este correo, ignóralo. El enlace expira en 24 horas.
        </p>
        <hr />
        <p style="color: #999; font-size: 11px;">Bank USAC — Sistema Bancario Seguro</p>
      </div>
    `;
    await this.sendEmail(to, 'Activa tu cuenta en Bank USAC', html);
  }

  async sendTransferNotification(
    to: string,
    amount: number,
    status: 'COMPLETED' | 'FAILED',
    correlationId: string,
  ): Promise<void> {
    const isCompleted = status === 'COMPLETED';
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: ${isCompleted ? '#34a853' : '#ea4335'};">
          Bank USAC — Transferencia ${isCompleted ? 'Exitosa' : 'Fallida'}
        </h2>
        <p>Tu transferencia por <strong>Q${amount.toFixed(2)}</strong>
           ha sido <strong>${isCompleted ? 'completada' : 'rechazada'}</strong>.</p>
        <p style="color: #666; font-size: 12px;">
          Referencia: ${correlationId}
        </p>
        <hr />
        <p style="color: #999; font-size: 11px;">Bank USAC — Sistema Bancario Seguro</p>
      </div>
    `;
    const subject = isCompleted
      ? `✅ Transferencia de Q${amount.toFixed(2)} completada`
      : `❌ Transferencia de Q${amount.toFixed(2)} fallida`;
    await this.sendEmail(to, subject, html);
  }
}
