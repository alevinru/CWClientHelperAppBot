export default function (ctx) {

  const { session, reply, from: { id: userId, first_name: firstName } } = ctx;

  if (!session.auth) {
    reply('We\'re not familiar yet. You should /auth first to start talking.');
    return;
  }

  reply(`Hi there, *${firstName}*! Your user id is *${userId}*`, { parse_mode: 'Markdown' });

}
