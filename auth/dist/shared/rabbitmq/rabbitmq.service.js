"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.RabbitMQService = void 0;
const common_1 = require("@nestjs/common");
const amqp = __importStar(require("amqplib"));
let RabbitMQService = class RabbitMQService {
    connection = null;
    channel = null;
    async onModuleInit() {
        return await this.connect();
    }
    async connect() {
        try {
            const rabbitMQUrl = process.env.RABBITMQ_URL;
            if (!rabbitMQUrl) {
                throw new Error('RABBITMQ_URL is not defined');
            }
            // Использование any для избежания проблем с типами
            this.connection = (await amqp.connect(rabbitMQUrl));
            this.channel = await this.connection.createChannel();
            await this.channel.assertExchange('user.events', 'topic', {
                durable: true,
            });
            console.log('RabbitMQ connected successfully');
        }
        catch (error) {
            console.error('RabbitMQ connection failed', error);
            setTimeout(() => this.connect(), 5000);
        }
    }
    async publish(exchange, routingKey, message) {
        try {
            if (!this.channel) {
                await this.connect();
            }
            const buffer = Buffer.from(JSON.stringify(message));
            this.channel.publish(exchange, routingKey, buffer, { persistent: true });
        }
        catch (error) {
            console.error('Publish error:', error);
        }
    }
    async consume(queue, routingKey, callback) {
        try {
            if (!this.channel) {
                await this.connect();
            }
            await this.channel.assertQueue(queue, { durable: true });
            await this.channel.bindQueue(queue, 'user.events', routingKey);
            await this.channel.consume(queue, async (msg) => {
                if (msg !== null) {
                    try {
                        const content = JSON.parse(msg.content.toString());
                        await callback(content);
                        this.channel.ack(msg);
                    }
                    catch (error) {
                        console.error('Message processing error:', error);
                        this.channel.nack(msg, false, false);
                    }
                }
            });
        }
        catch (error) {
            console.error('Consume error:', error);
        }
    }
    async closeConnection() {
        try {
            if (this.channel) {
                await this.channel.close();
                this.channel = null;
            }
            if (this.connection) {
                await this.connection.close();
                this.connection = null;
            }
        }
        catch (error) {
            console.error('Error closing RabbitMQ connection:', error);
        }
    }
};
exports.RabbitMQService = RabbitMQService;
exports.RabbitMQService = RabbitMQService = __decorate([
    (0, common_1.Injectable)()
], RabbitMQService);
