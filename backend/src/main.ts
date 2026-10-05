import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { mkdirSync } from 'fs';
import { join } from 'path';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { UPLOAD_DIR } from './modules/auctions/auctions.controller';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Ảnh sản phẩm upload lên được phục vụ tại /uploads/<tên file>
  mkdirSync(UPLOAD_DIR, { recursive: true });
  app.useStaticAssets(join(process.cwd(), UPLOAD_DIR), { prefix: `/${UPLOAD_DIR}/` });

  // Cho phép CORS để Frontend gọi được API
  app.enableCors();

  // Validate request body theo DTO (class-validator)
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  // Cấu hình Swagger
  const config = new DocumentBuilder()
    .setTitle('Bidding System API')
    .setDescription('Tài liệu API cho Hệ thống Đấu giá Trực tuyến')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
    
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, {
    explorer: true,
    swaggerOptions: {
      persistAuthorization: true,
    },
  });

  await app.listen(process.env.PORT ?? 3000);
  console.log(`Application is running on: ${await app.getUrl()}`);
  console.log(`Swagger Docs available at: ${await app.getUrl()}/api/docs`);
}
bootstrap();
