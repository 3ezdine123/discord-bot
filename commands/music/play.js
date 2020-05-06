const { Command } = require('discord.js-commando');
const puppeteer = require('puppeteer');
const ytdl = require('ytdl-core-discord');
const Youtube = require('simple-youtube-api');
const youtube = new Youtube(process.env.YOUTUBE_API_KEY);

module.exports = class Play extends Command {
    constructor(client) {
        super(client, {
            name: 'play',
            memberName: 'play',
            group: 'music',
            description: 'plays audio from youtube or facebook',
            guildOnly: true,
            clientPermissions: ['SPEAK', 'CONNECT'],
            args: [
                {
                    key: 'query',
                    prompt: 'what do you want to listen to?',
                    type: 'string',
                    validate: query => query.length > 0
                }
            ],
            throttling: {
                usages: 1,
                duration: 5
            }
        });
    }

    run = async(message, { query }) => {
        try {
            const voiceChannel = message.member.voice.channel;

            if (!voiceChannel) return message.reply('you need to join a channel!');

            if (query.match(/^(http(s)?:\/\/)?((w){3}.)?youtu(be|.be)?(\.com)?\/\S+/)) {
                const link = query.match(/^(http(s)?:\/\/)?((w){3}.)?youtu(be|.be)?(\.com)?\/\S+/)[0];
                const id = link.replace(/(>|<)/gi, '').split(/(vi\/|v=|\/v\/|youtu\.be\/|\/embed\/)/)[2].split(/[^0-9a-z_\-]/i)[0];

                const video = await youtube.getVideoByID(id);
                const title = video.title;
                const duration = this.formatDuration(video.duration);
                const thumbnail = video.thumbnails.high.url;

                const data = {
                    type: 'youtube',
                    link,
                    title,
                    duration: duration !== '00:00:00' ? duration : 'Live Stream',
                    thumbnail,
                    voiceChannel
                };

                message.guild.music.queue.push(data);

                if (message.guild.music.isPlaying === false || message.guild.music.isPlaying === undefined) {
                    message.guild.music.isPlaying = true;
                    return this.play(message.guild.music.queue, message);
                } else {
                    return message.reply(`${data.title} added to queue`);
                }
            } else if (query.match(/^(http(s)?:\/\/)?((w){3}.)?facebook?(\.com)?\/\S+\/videos\/\S+/)) {
                const link = query.match(/^(http(s)?:\/\/)?((w){3}.)?facebook?(\.com)?\/\S+\/videos\/\S+/)[0];

                const browser = await puppeteer.launch({
                    timeout: 0
                });
                const page = await browser.newPage();
                page.setDefaultNavigationTimeout(0);
                page.setDefaultTimeout(0);
                await page.goto(link, { waitUntil: 'networkidle2' });
                const titleHandle = await page.$('title');
                const metaHandle = await page.$('meta[property="og:video:url"]');
                const durationString = (await page.content()).match(/mediaPresentationDuration=\\"\S+\\"/) || false;
                const durationArr = durationString ? durationString.toString().replace(/mediaPresentationDuration=\\"/, '').replace(/\\"/, '').trim().split(/\D/).slice(2, 5).map(time => parseInt(time)) : false;
                
                const duration = durationArr ? this.formatDuration({ hours: durationArr[0], minutes: durationArr[1], seconds: durationArr[2] + 1 }) : 'Live Stream';
                const title = await page.evaluate(title => title.innerText.replace(/\s\|\sfacebook/i, ''), titleHandle);
                const videoLink = await page.evaluate(meta => meta.getAttribute('content'), metaHandle);

                const data = {
                    type: 'facebook',
                    link: videoLink,
                    title,
                    duration,
                    voiceChannel
                };

                message.guild.music.queue.push(data);

                if (message.guild.music.isPlaying === false || message.guild.music.isPlaying === undefined) {
                    message.guild.music.isPlaying = true;
                    return this.play(message.guild.music.queue, message);
                } else {
                    return message.reply(`${data.title} added to queue`);
                }
            } else if (query.match(/^(http(s)?:\/\/)?((w){3}\S)?\S+(\.)\S+\/\S+\.(\S){3}/)) {
                // const link = query.match(/^(http(s)?:\/\/)?((w){3}\S)?\S+(\.)\S+\/\S+\.(\S){3}/)[0];

                // const dispatcher = connection.play(link);

                // dispatcher.on('start', () => {
                //     return message.reply('playing!');
                // });
            } else {
                const videos = await youtube.searchVideos(query, 1);
                if (!videos.length === 1) return message.reply('nothing found!');

                const video = await youtube.getVideoByID(videos[0].raw.id.videoId);

                const title = video.title;
                const duration = this.formatDuration(video.duration);
                const thumbnail = video.thumbnails.high.url;

                const data = {
                    type: 'youtube-search',
                    link: `https://www.youtube.com/watch?v=${video.id}`,
                    title,
                    duration: duration !== '00:00:00' ? duration : 'Live Stream',
                    thumbnail,
                    voiceChannel
                };

                message.guild.music.queue.push(data);

                if (message.guild.music.isPlaying === false || message.guild.music.isPlaying === undefined) {
                    message.guild.music.isPlaying = true;
                    return this.play(message.guild.music.queue, message);
                } else {
                    return message.reply(`${data.title} added to queue`);
                }
            }
        } catch(err) {
            console.error(err);
            return message.reply('cannot play what you requested!');
        }
    }

    play = async(queue, messsage) => {
        try {
            const voiceChannel = queue[0].voiceChannel;
            const connection = await voiceChannel.join();
            let dispatcher;

            switch (queue[0].type) {
                case 'youtube': { dispatcher = connection.play(await ytdl(queue[0].link, { quality: 'highestaudio' }), { type: 'opus' }); break; }
                case 'facebook': { dispatcher = connection.play(queue[0].link); break; }
                case 'youtube-search': { dispatcher = connection.play(await ytdl(queue[0].link), { type: 'opus' }); break; }
            }

            dispatcher.on('start', () => {
                messsage.guild.music.dispatcher = dispatcher;
                messsage.guild.music.nowPlaying = queue[0];
                dispatcher.setVolume(messsage.guild.music.volume);
                messsage.reply(`${queue[0].title} is playing`);
                return queue.shift();
            });

            dispatcher.on('finish', () => {
                if (queue.length >= 1) return this.play(queue, messsage);
                else {
                    messsage.guild.music.isPlaying = false;
                    messsage.say('queue ended');
                    return voiceChannel.leave();
                }
            });

            dispatcher.on('error', err => {
                messsage.guild.music.queue = [];
                messsage.guild.music.isPlaying = false;
                messsage.guild.music.nowPlaying = false;
                messsage.say('error occured');
                voiceChannel.leave();
                throw err;
            });
        } catch(err) {
            console.error(err);
            return message.reply('cannot play what you requested!');
        }
    }

    formatDuration = durationObject => {
        return `${durationObject.hours < 10 ? '0' + durationObject.hours : durationObject.hours ? durationObject.hours : '00'}:${durationObject.minutes < 10 ? '0' + durationObject.minutes : durationObject.minutes ? durationObject.minutes : '00'}:${durationObject.seconds < 10 ? '0' + durationObject.seconds : durationObject.seconds ? durationObject.seconds : '00'}`;
    }
}