import { Module } from '@nestjs/common';
import { LlmModule } from '../llm/llm.module';
import { AppointmentsModule } from '../appointments/appointments.module';
import { HandoffModule } from '../handoff/handoff.module';
import { ConversationsService } from './conversations.service';
import { ConversationStateStore } from './conversation-state.store';
import { ConversationStateMachine } from './conversation-state.machine';
import { IntentClassifierService } from './intent-classifier.service';

@Module({
  imports: [LlmModule, AppointmentsModule, HandoffModule],
  providers: [
    ConversationsService,
    ConversationStateStore,
    ConversationStateMachine,
    IntentClassifierService,
  ],
  exports: [ConversationsService],
})
export class ConversationsModule {}
