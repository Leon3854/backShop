import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  app.use(helmet()); //
  app.useGlobalPipes(new ValidationPipe());
  app.enableCors({
    origin: true, // настройки под фронтенд
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  await app.listen(process.env.PORT || 3001);
  console.log(`Cart service is running on: ${await app.getUrl()}`);
}
bootstrap();
