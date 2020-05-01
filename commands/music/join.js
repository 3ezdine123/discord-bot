const { Command } = require('discord.js-commando');

module.exports = class JoinCommand extends Command {
    constructor(client) {
        super(client, {
            name: 'join',
            memberName: 'join',
            group: 'music',
            description: 'joins a voice channel',
            aliases: ['summon'],
            guildOnly: true
        });
    }

    async run(message) {
        const voiceChannel = message.member.voice.channel;

        if (!voiceChannel) return message.reply('you need to join a channel!');

        const connection = await voiceChannel.join();

        return message.say('joined!');
    }
}