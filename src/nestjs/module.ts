import { Module } from '@nestjs/common';
import { RouterController } from './controller';
import { RouterService } from './service';
@Module({
  imports: [],
  controllers: [RouterController],
  providers: [RouterService],
})
export class AppModule {}