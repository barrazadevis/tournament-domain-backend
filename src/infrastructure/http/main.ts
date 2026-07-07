import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

/**
 * Este backend es API + WebSocket puro. El frontend (React + Vite) vive en
 * un repo independiente ("tournament-frontend") y se conecta vía HTTP/WS
 * usando la URL de este servidor — por eso CORS está habilitado.
 */
async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.enableCors({ origin: '*' });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Torneo TGA — API')
    .setDescription(
      'API del torneo: equipos, rondas, matches y clasificatoria. ' +
        'Los eventos en tiempo real (timer, submissions, veredictos) van por ' +
        'WebSocket en los namespaces /team, /judge y /viewer — no aparecen aquí. ' +
        'El frontend vive en un repo separado (tournament-frontend).',
    )
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, swaggerDocument);

  await app.listen(3000);
  // eslint-disable-next-line no-console
  console.log('Tournament API en http://localhost:3000');
  // eslint-disable-next-line no-console
  console.log('  Swagger: http://localhost:3000/docs');
  // eslint-disable-next-line no-console
  console.log('  Frontend: corre "npm run dev" en el repo tournament-frontend (puerto 5173)');
}

bootstrap();
