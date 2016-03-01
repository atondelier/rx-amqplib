let severities = process.argv.slice(2);

if (severities.length < 1) {
  console.warn('Usage: receive_logs_direct.ts [info] [warning] [error]');
  process.exit(1);
}

import RxAmqpLib from '../rx-amqplib/RxAmqpLib';
import RxConnection from '../rx-amqplib/RxConnection';
import RxChannel from '../rx-amqplib/RxChannel';
import * as Rx from 'rx';
import * as R from 'ramda';

const config = {
  host: 'amqp://localhost',
  exchange: 'direct_logs',
  exchangeType: 'direct'
};

RxAmqpLib.newConnection(config.host)
  .flatMap(connection => connection.createChannel())
  .flatMap(channel => channel.assertExchange(config.exchange, config.exchangeType, { durable: false }))
  .flatMap(reply => reply.channel.assertQueue('', { exclusive: true }))
  .flatMap(reply => Rx.Observable
    .from(severities)
    .flatMap(severity => reply.channel.bindQueue(reply.queue, config.exchange, severity))
    .bufferWithCount(severities.length)
    .map(() => reply)
  )
  .doOnNext(() => console.log(' [*] Waiting for logs.'))
  .flatMap(reply => reply.channel.consume(reply.queue, { noAck: true }))
  .subscribe(
    msg => console.log(' [x] %s: \'%s\'', msg.fields.routingKey, msg.content.toString()),
    console.error
  );
