/**
 * Mirrors the `ErrorCode` union from apps/api/src/shared/http/error-codes.ts.
 * The API's `message` field stays in English (it's the HTTP contract for
 * integrators of any language) — `code` is the stable discriminator this
 * map translates into the Spanish text shown in the dashboard.
 */
export type ErrorCode =
  | 'VALIDATION_FAILED'
  | 'SUBSCRIBER_NOT_FOUND'
  | 'DELIVERY_NOT_FOUND'
  | 'DEAD_DELIVERY_NOT_FOUND'
  | 'IDEMPOTENCY_KEY_REQUIRED'
  | 'IDEMPOTENCY_CONFLICT'
  | 'AUTH_HEADER_MISSING'
  | 'AUTH_KEY_INVALID'
  | 'TARGET_URL_INVALID'
  | 'TARGET_URL_UNSUPPORTED_PROTOCOL'
  | 'TARGET_URL_LOCALHOST'
  | 'TARGET_URL_PRIVATE_ADDRESS'
  | 'TARGET_URL_DNS_FAILED'
  | 'TARGET_URL_RESOLVES_PRIVATE';

type Details = Record<string, unknown> | undefined;

function detailString(details: Details, key: string): string {
  const value = details?.[key];
  return typeof value === 'string' ? value : '';
}

// Record<ErrorCode, ...> makes TypeScript itself enforce that every code in
// the union above has a translation — add one without the other and this
// file fails to compile.
const MESSAGES: Record<ErrorCode, (details: Details) => string> = {
  VALIDATION_FAILED: () => 'Los datos enviados no son válidos.',
  SUBSCRIBER_NOT_FOUND: () => 'No se encontró el suscriptor.',
  DELIVERY_NOT_FOUND: () => 'No se encontró la entrega.',
  DEAD_DELIVERY_NOT_FOUND: () => 'No se encontró esa entrega en la cola de muertos.',
  IDEMPOTENCY_KEY_REQUIRED: () => 'Falta el header Idempotency-Key.',
  IDEMPOTENCY_CONFLICT: (details) =>
    `La Idempotency-Key "${detailString(details, 'idempotencyKey')}" ya se usó con un payload distinto.`,
  AUTH_HEADER_MISSING: () => 'Falta el header de autorización.',
  AUTH_KEY_INVALID: () => 'La API key no es válida.',
  TARGET_URL_INVALID: () => 'La URL no es válida.',
  TARGET_URL_UNSUPPORTED_PROTOCOL: () => 'Sólo se permiten URLs http y https.',
  TARGET_URL_LOCALHOST: () => 'No se permite localhost como destino.',
  TARGET_URL_PRIVATE_ADDRESS: (details) =>
    `${detailString(details, 'hostname') || 'Esa dirección'} es una dirección privada, loopback o link-local — no se permite como destino.`,
  TARGET_URL_DNS_FAILED: (details) =>
    `No se pudo resolver el hostname "${detailString(details, 'hostname')}".`,
  TARGET_URL_RESOLVES_PRIVATE: (details) =>
    `El hostname "${detailString(details, 'hostname')}" resuelve a ${detailString(details, 'address')}, una dirección privada, loopback o link-local — no se permite como destino.`,
};

const STATUS_FALLBACKS: Record<number, string> = {
  400: 'La solicitud no es válida.',
  401: 'No estás autenticado.',
  403: 'No tenés permiso para hacer esto.',
  404: 'No se encontró el recurso.',
  409: 'Hay un conflicto con el estado actual.',
  422: 'No se pudo procesar la solicitud.',
  429: 'Demasiadas solicitudes — probá de nuevo en un momento.',
};

function isErrorCode(value: string | undefined): value is ErrorCode {
  return value !== undefined && value in MESSAGES;
}

export function translateApiError(
  status: number,
  code: string | undefined,
  details: Details,
): string {
  if (isErrorCode(code)) {
    return MESSAGES[code](details);
  }
  return STATUS_FALLBACKS[status] ?? `Ocurrió un error inesperado (${status}).`;
}
