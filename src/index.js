require('colors');
const inquirer = require('inquirer');
const getData = require('./utils/request');
const createChoice = ({ name, choices }) => {
    return inquirer.prompt([
        {
            name,
            message: '请选择',
            type: 'rawlist',
            choices,
            loop: false,
        },
    ]);
};
const pickStr = ({ string, start, end }) => {
    const rule = `(?<=${start})[\\s\\S\\r\\n]*?(?=${end})`;
    const reg = new RegExp(rule, 'g');
    return string.match(reg);
};
// 内页
const getDetail = (url, type = '') => {
    getData({
        url: url.indexOf('https') > -1 ? url : `https://www.douban.com/${url}`,
        method: 'get',
    }).then((res) => {
        if (type === 'movie') {
            const rep =
                /(?<=<script type="application\/ld\+json">)[\s\S\r\n]*?(?=<\/script>)/g;
            let result = res.body.match(rep);
            result = JSON.parse(result);
            console.log({
                name: result.name,
                thumb: `https://images.weserv.nl/?url=${result.image.replace(
                    'https',
                    'http'
                )}`,
                link: `${res.url}`,
                description: result.description
                    ? result.description.replace(/[\r\n\s]*/g, '')
                    : '',
                time: result.datePublished,
                score: result.aggregateRating.ratingValue,
            });
            return true;
        }
        if (type === 'book') {
            // console.log(res.body);
            const rep =
                /(?<=<meta property="[a-zA-z]+:[a-zA-z]+" content=")[\s\S]*?(?="\s\/>)/g;
            let result = res.body.match(rep);
            console.log({
                name: result[0],
                thumb: `https://images.weserv.nl/?url=${result[4].replace(
                    'https',
                    'http'
                )}`,
                link: result[3],
                description: result[1]
                    ? result[1].replace(/[\r\n\s]*/g, '')
                    : '',
                author: result[6],
            });
            return true;
        }
        if (type === 'group') {
            let title = pickStr({
                string: res.body,
                start: '<title>',
                end: '</title>',
            });
            title = Array.isArray(title) ? title[0].replace(/(\s*)/g, '') : '';

            let description = pickStr({
                string: res.body,
                start: '<div class="group-info-item group-intro link-2-title limit-height" data-max_line="25" data-padding="30" data-border="1">',
                end: '</div>',
            });
            description = Array.isArray(description)
                ? JSON.stringify(description).replace(
                      /(<.*?>|\["|"\]|\s*|[\\[nr])*/g,
                      ''
                  )
                : '';

            let list = pickStr({
                string: res.body,
                start: '<table class="olt">',
                end: '</table>',
            });
            list = list[0].match(/(<tr class="">)[\s\S\r\n]*?(<\/tr>)/g);
            const groupList = list.map((item, index) => {
                let title = item.match(
                    /(?<=<a\shref="(.)*"\stitle=")[\s\S\r\n]*?(?=")/g
                );
                title = Array.isArray(title) ? title[0] : '';

                let link = item.match(/(?<=<a\shref=")[\s\S\r\n]*?(?=")/g);
                link = Array.isArray(link) ? link[0] : '';

                let time = item.match(
                    /(?<=<td\snowrap="nowrap"\sclass="time">)[0-9-]*?(?=<\/td>)/g
                );
                time = Array.isArray(time) ? time[0] : '';

                return {
                    name: `(${time || '-'}) - ${title}`,
                    value: link,
                    time,
                };
            });
            console.log(title);
            console.log(description);
            createChoice({
                name: 'url',
                choices: groupList,
            })
                .then((answers) => {
                    getData({
                        url: answers.url,
                        method: 'get',
                    }).then((detail) => {
                        const rep =
                            /(?<=<div\sclass="topic-content">)[\s\S\r\n]*?(?=<\/div>)/g;
                        let result = detail.body.match(rep);
                        result = Array.isArray(result) ? result[0] : '';
                        result = result.replace(/(<.*?>|[\s\r\n]*)/g, '');
                        console.log(result);
                    });
                })
                .catch((error) => {
                    console.log(error.toString());
                });
            return false;
        }
        console.log('Type error');
        return false;
    });
};
const getSearch = (keywords) => {
    if (!keywords) {
        console.log('Please enter the keywords'.red);
        return false;
    }
    getData({
        url: `https://m.douban.com/search/?query=${keywords}`,
        method: 'get',
    }).then((res) => {
        const reg = /(?<=<li>)[\s\S\r\n]*?(?=<\/li>)/g;
        let result = res.body.match(reg);
        if (!Array.isArray(result)) {
            console.log('获取失败');
            return false;
        }
        let list = result.map((item) => {
            const titleReg =
                /(?<=<span class="subject-title">)[\s\S\r\n]*?(?=<\/span>)/;
            const urlReg = /(?<=<a href=")[\s\S\r\n]*?(?=">)/;
            const url = item.match(urlReg) ? item.match(urlReg)[0] : '';
            const arr = url.split('/');
            const name = item.match(titleReg) ? item.match(titleReg)[0] : '';

            return {
                name: name ? `(${arr[1] || arr[3]})${name}` : '',
                value: url,
            };
        });
        list = list.filter((item) => {
            return item.name && item.value;
        });

        createChoice({
            name: 'url',
            choices: list,
        })
            .then((answers) => {
                const arr = answers.url.split('/');
                getDetail(answers.url, arr[1]);
            })
            .catch((error) => {
                console.log(error.toString());
            });
    });
};

inquirer
    .prompt([
        {
            name: 'keywords',
            message: '请输入关键词',
            type: 'input',
            loop: false,
            validate: (input) => {
                if (input) {
                    return true;
                } else {
                    throw new Error('请输入关键词');
                }
            },
        },
    ])
    .then((answer) => {
        getSearch(answer.keywords);
    });
