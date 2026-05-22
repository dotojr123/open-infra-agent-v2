import { Module } from '@nestjs/common';
import { McpModule } from '@rekog/mcp-nest';
import { ComputerUseModule } from '../computer-use/computer-use.module';
import { ComputerUseTools } from './computer-use.tools';

@Module({
  imports: [
    ComputerUseModule,
    McpModule.forRoot({
      name: 'iagenciad',
      version: '1.0.0',
      sseEndpoint: '/mcp',
    }),
  ],
  providers: [ComputerUseTools],
})
export class IagenciaMcpModule {}
