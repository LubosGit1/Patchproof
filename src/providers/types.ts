export type ProviderName = 'mock' | 'anthropic';

export interface ProviderPrompt {
  system: string;
  user: string;
}

export interface ProviderParameters {
  maxTokens: number;
  temperature: number;
}

export interface ProviderRequest {
  prompt: ProviderPrompt;
  model: string;
  parameters: ProviderParameters;
}

export interface ProviderResponse {
  provider: ProviderName;
  model: string;
  parameters: ProviderParameters;
  text: string;
  scenario?: string;
}

export interface PatchProvider {
  readonly name: ProviderName;
  generate(request: ProviderRequest): Promise<ProviderResponse>;
}
