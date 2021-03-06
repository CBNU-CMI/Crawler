const {
    promisePool,
    hasNotice,
    getPushAllowUser,
    insertNotice
} = require('../db')

const {
    log
} = require('../Log')

const {
    send_notice
} = require('../fm')

class Page {
    constructor(page, siteList, contentsQueue) {
        this.page = page
        this.siteList = siteList
        this.contentsQueue = contentsQueue
        this.nextSiteIndex = 0
    }

    async startCollect() {
        const site = this.siteList[this.nextSiteIndex]

        await this.page.goto(site.url)
        await this.page.evaluate(site.getData.toString())
        // 딜레이 1분
        await this.page.waitFor(60000)

        let notice_list = await this.page.evaluate(() => {
            return getData()
        })

        for (const notice of notice_list) {
            // console.log(notice)

            try {
                // 게시물이 존재하는지 여부
                if (!(await hasNotice(notice))) {
                    log.info("[새로운 게시물] " + JSON.stringify(notice))

                    var result = await insertNotice(notice)
                    // console.log(result)
                    notice.id = result.insertId
                    this.contentsQueue.enqueue(notice)

                    // 3초뒤에 유저에게 푸쉬메시지 보내기
                    setTimeout(async ()=>{
                        let user = await getPushAllowUser(notice.site_id)
                        // console.log(user)
                        for (const u of user) {
                            send_notice(u.fcm_token, {
                                title: `[${notice.site}] ${notice.category}`,
                                body: notice.title,
                                notice_id: notice.id,
                                category: `${notice.site} | ${notice.category}`
                            })
                        }
                    },3000)
                   
                }
            } catch (error) {
                log.error(error, 'ListCrawlerPage > startCollect')
                log.error(JSON.stringify(notice), 'ListCrawlerPage > startCollect')
                // await errorContents(notice.id)
            }


        }

        this.nextSiteIndex++
        if (this.nextSiteIndex >= this.siteList.length) this.nextSiteIndex = 0

        // 딜레이 3초
        setTimeout(this.startCollect.bind(this), 3000)
    }

}

module.exports = Page