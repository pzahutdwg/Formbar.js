import Bot from "./bot.js";
process.stdin.setEncoding('utf8');
const consoleIn = process.stdin;
export const FORMBAR_URL = 'http://localhost:420';
const bots = [];
let tasks = [];
let takenIds = [];
export class Task {
    id;
    task;
    finished = false;
    success = true;
    constructor(task) {
        this.id = 1;
        while (takenIds.includes(this.id)) {
            this.id++;
        }
        this.task = task;
        takenIds.push(this.id);
        tasks.push(this);
    }
    finish(success) {
        this.finished = true;
        this.success = success;
        setTimeout(() => {
            let interval = setInterval(() => {
                let me = tasks.find(t => t.id === this.id);
                if (me) {
                    tasks.splice(tasks.indexOf(me), 1);
                    main();
                    clearInterval(interval);
                }
            }, 0);
        }, 2000);
    }
}
consoleIn.on('data', (data) => {
    let terms = data.replaceAll(/[\r\n]+/gm, '').trim().split(' ');
    if (terms[0] == 'make' && Number(terms[1])) {
        makeBots(Number(terms[1]));
    }
    if (terms[0] == 'enroll' && terms[1] && terms[2] && String(terms[2])) {
        let amount = Number(terms[1]);
        if (terms[1] === 'all')
            amount = Infinity;
        enroll(amount, terms[2]);
    }
    if (terms[0] == 'leave' && terms[1]) {
        let amount = Number(terms[1]);
        if (terms[1] === 'all')
            amount = Infinity;
        leave(amount);
    }
    if (terms[0] == 'getClass' && terms[1]) {
        let amount = Number(terms[1]);
        if (terms[1] === 'all')
            amount = Infinity;
        getClass(amount);
    }
    if (terms[0] == 'cls' || terms[0] == 'clear')
        console.clear();
    if (terms[0] == 'exit') {
        leave(Infinity);
        process.exit(0);
    }
    if (terms[0] == 'vote' && terms[1] && terms[2] && String(terms[2])) {
        let amount = Number(terms[1]);
        if (terms[1] === 'all')
            amount = Infinity;
        vote(amount, terms[2]);
    }
});
async function makeBots(amount) {
    for (let i = 0; i < amount; i++) {
        let bot = new Bot(i + 1);
        bots.push(bot);
        bot.makeAccount();
        console.clear();
    }
}
async function enroll(amount, code) {
    amount = Math.min(amount, bots.length);
    for (let i = 0; i < amount; i++) {
        bots[i].enroll(code);
        console.clear();
    }
}
async function leave(amount) {
    amount = Math.min(amount, bots.length);
    for (let i = 0; i < amount; i++) {
        bots[i].leave();
    }
}
async function getClass(amount) {
    amount = Math.min(amount, bots.length);
    for (let i = 0; i < amount; i++) {
        bots[i].getClass();
    }
}
async function vote(amount, answer) {
    amount = Math.min(amount, bots.length);
    for (let i = 0; i < amount; i++) {
        await bots[i].getClass();
        bots[i].vote(answer);
    }
}
function main() {
    console.clear();
    let types = [];
    for (let task of tasks) {
        types.push(task.task);
    }
    types = [...new Set(types)];
    for (let type of types) {
        let tasksOfType = tasks.filter(t => t.task === type);
        const remaining = tasksOfType.filter(t => !t.finished).length;
        const failed = tasksOfType.filter(t => t.finished && t.success === false).length;
        const successful = tasksOfType.filter(t => t.finished && t.success).length;
        const finished = tasksOfType.filter(t => t.finished).length;
        console.log(`${type}: Remaining: ${remaining}/${tasksOfType.length} Failed: ${Math.round(failed / finished * 100) || 0}% Successful: ${Math.round(successful / finished * 100) || 0}%`);
    }
}
setInterval(() => { if (tasks.length) {
    main();
} }, 100);
//# sourceMappingURL=app.js.map