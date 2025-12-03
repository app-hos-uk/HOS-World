import { Module } from '@nestjs/common';
import { SearchService } from './search.service';
import { SearchController } from './search.controller';
import { ElasticsearchModule } from '@nestjs/elasticsearch';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  imports: [
    ElasticsearchModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => {
        const node = configService.get('ELASTICSEARCH_NODE') || 'http://localhost:9200';
        const username = configService.get('ELASTICSEARCH_USERNAME');
        const password = configService.get('ELASTICSEARCH_PASSWORD');
        
        const config: any = {
          node,
          maxRetries: 10,
          requestTimeout: 60000,
          pingTimeout: 3000,
          sniffOnStart: true,
        };
        
        // Add authentication if credentials are provided
        if (username && password) {
          config.auth = {
            username,
            password,
          };
        }
        
        return config;
      },
      inject: [ConfigService],
    }),
  ],
  controllers: [SearchController],
  providers: [SearchService],
  exports: [SearchService],
})
export class SearchModule {}

