import { Module } from '@nestjs/common';
import { CollectionsController } from './collections.controller';
import { CommonModule } from '../common/common.module';

@Module({
  imports: [CommonModule],
  controllers: [CollectionsController],
  providers: [],
})
export class CollectionsModule {}
