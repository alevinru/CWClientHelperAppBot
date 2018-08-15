export default function (ctx) {

  const { session, reply, from: { id: userId } } = ctx;

  if (!session.auth) {
    reply('We\'re not familiar yet. You should /auth first to start talking.');
    return;
  }

  reply(`Hi there, buddy! Your user id is *${userId}*`, { parse_mode: 'Markdown' });

}
