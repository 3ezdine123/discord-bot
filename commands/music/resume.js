const { Command } = require('discord.js-commando');
const { MessageEmbed } = require('discord.js');
const winston = require('winston');

const logger = winston.createLogger({
    transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: 'logs.log' }),
    ],
    format: winston.format.combine(
        winston.format.printf(log => `${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()} - [${log.level.toUpperCase()}] - ${log.message}`),
    )
});

module.exports = class Play extends Command {
    constructor(client) {
        super(client, {
            name: 'resume',
            memberName: 'resume',
            group: 'music',
            description: 'resumes the player',
            guildOnly: true,
            throttling: {
                usages: 1,
                duration: 3
            }
        });
    }

    run = async message => {
        try {
            if (!message.member.voice.channel) return message.reply('you need to join a channel!');
            else if (!message.guild.music.isPlaying) {
                const embed = new MessageEmbed().setColor('#ff0000').setTitle(':x: Play something first');
                return message.say({ embed });
            }
            else if (!message.guild.music.paused) {
                const embed = new MessageEmbed().setColor('#ff0000').setTitle(':x: Playing already');
                return message.say({ embed });
            }
            else {
                message.guild.music.paused = false;
                message.guild.music.dispatcher.resume();
                const embed = new MessageEmbed().setColor('#000099').setTitle(':arrow_forward: Resumed player');
                return await message.say({ embed });
            }
        } catch(err) {
            logger.log('error', err);
            const embed = new MessageEmbed().setColor('#ff0000').setTitle(`:x: Error occured: ${err.message}`);
            return message.say({ embed });
        }
    }
}