export interface ValidationDetail {
  field: string;
  message: string;
}

export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
    public readonly details?: ValidationDetail[],
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const Errors = {
  validation(details: ValidationDetail[]): AppError {
    return new AppError(400, 'VALIDATION_ERROR', 'Los datos enviados no son válidos', details);
  },

  invalidCredentials(): AppError {
    return new AppError(401, 'INVALID_CREDENTIALS', 'Username o contraseña incorrectos');
  },

  invalidToken(): AppError {
    return new AppError(401, 'INVALID_TOKEN', 'Token inválido o expirado');
  },

  customerInactive(): AppError {
    return new AppError(403, 'CUSTOMER_INACTIVE', 'El cliente debe activar su cuenta; revise su correo');
  },

  customerBlocked(): AppError {
    return new AppError(403, 'CUSTOMER_BLOCKED', 'El cliente se encuentra bloqueado');
  },

  customerNotFound(): AppError {
    return new AppError(404, 'CUSTOMER_NOT_FOUND', 'Cliente no encontrado');
  },

  customerAlreadyExists(): AppError {
    return new AppError(409, 'CUSTOMER_ALREADY_EXISTS', 'El documento, correo o username ya existe');
  },

  staleVersion(): AppError {
    return new AppError(409, 'STALE_VERSION', 'El cliente fue modificado por otra solicitud; consulte la versión actual');
  },

  alreadyBlocked(): AppError {
    return new AppError(409, 'CUSTOMER_ALREADY_BLOCKED', 'El cliente ya se encuentra bloqueado');
  },

  invalidActivationToken(): AppError {
    return new AppError(400, 'INVALID_ACTIVATION_TOKEN', 'El enlace de activación es inválido o expiró');
  },

  activationAlreadyUsed(): AppError {
    return new AppError(409, 'ACTIVATION_TOKEN_ALREADY_USED', 'El enlace de activación ya fue utilizado');
  },

  forbidden(): AppError {
    return new AppError(403, 'FORBIDDEN', 'No tiene permisos para realizar esta operación');
  },

  idempotencyKeyUsed(): AppError {
    return new AppError(409, 'IDEMPOTENCY_KEY_USED', 'La clave de idempotencia ya fue utilizada');
  },
};
