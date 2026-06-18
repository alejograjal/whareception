import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Env } from '../config/env.schema';
import { LLM_PROVIDER } from './llm-provider.interface';
import { MockLlmProvider } from './mock-llm.provider';
import { OpenAiProvider } from './openai.provider';

/**
 * Binds the LLM_PROVIDER token to either the OpenAI or mock implementation
 * based on LLM_PROVIDER env. Both concrete classes are registered so they can
 * be injected directly in tests if needed.
 */
@Module({
  providers: [
    MockLlmProvider,
    OpenAiProvider,
    {
      provide: LLM_PROVIDER,
      inject: [ConfigService, MockLlmProvider, OpenAiProvider],
      useFactory: (
        config: ConfigService<Env, true>,
        mock: MockLlmProvider,
        openai: OpenAiProvider,
      ) => {
        return config.get('LLM_PROVIDER', { infer: true }) === 'openai'
          ? openai
          : mock;
      },
    },
  ],
  exports: [LLM_PROVIDER],
})
export class LlmModule {}
