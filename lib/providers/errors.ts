export class ProviderConfigurationError extends Error {
  status = 400;
}

export class ProviderTimeoutError extends Error {
  status = 504;
}

export class ProviderResponseError extends Error {
  status = 502;
}
