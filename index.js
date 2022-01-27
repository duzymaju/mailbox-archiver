const { existsSync, mkdirSync, writeFileSync } = require('fs');
const { connect } = require('imap-simple');
const moment = require('moment');

(async () => {
    const [host, user, password, port, tls] = process.argv.slice(2);
    if (!host || !user || !password) {
        console.error('Host, user login and password have to be set as arguments!');
        return;
    }
    const connection = await connect({
        imap: {
            authTimeout: 3000,
            host,
            password,
            port: port ? parseInt(port, 10) : 993,
            tls: tls !== 'false',
            user,
        },
    });
    const dir = `${__dirname}/${user}`;
    if (!existsSync(dir)) {
        mkdirSync(dir, 0o744);
    }
    const boxes = await connection.getBoxes();
    const messageCounters = {};
    await Object.keys(boxes).reduce(
        (promise, boxName) => promise.then(() => getMessages(connection, dir, boxName)).then(messagesNumber => {
            messageCounters[boxName] = messagesNumber;
        }),
        Promise.resolve(),
    );
    console.log('Messages saved:');
    console.log(messageCounters);
    await connection.end();
})();

const getMessages = async (connection, mailBoxDir, boxName) => {
    await connection.openBox(boxName);
    const messages = await connection.search(['ALL'], { bodies: ['HEADER', 'TEXT'], struct: true });
    if (messages.length > 0) {
        const dir = `${mailBoxDir}/${boxName}`;
        if (!existsSync(dir)) {
            mkdirSync(dir, 0o744);
        }
        messages.forEach(message => {
            const headers = message.parts.find(part => part.which === 'HEADER');
            const text = message.parts.find(part => part.which === 'TEXT');
            if (headers && headers.body && text && text.body) {
                const time = moment(new Date(headers.body.date)).format().replace(/[/:]/g, '-');
                const subject = headers.body.subject ? headers.body.subject.join(' - ').replace(/[/:]/g, '-') : '';
                const file = `${dir}/${time} - ${subject}.json`;
                try {
                    writeFileSync(file, JSON.stringify(message));
                } catch (err) {
                    console.error('ERROR 2', err);
                }
            } else {
                console.error('ERROR 1');
            }
        });
    }
    await connection.closeBox();
    return messages.length;
};
