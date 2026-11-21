// 海淀种子数据：演示用，全部离线、无外链。
export const READERS = ["林间","阿冗","迟到的读者","王林","周雨","陈默","苏木","一棵树","老张","小满"];
export const QUESTIONS = [
  "35岁技术转管理，怕丢了手艺又带不好人","大厂裁员后不知道该继续做技术还是换个活法",
  "读不进长文本，翻开书就想刷手机","工作三年，热情被磨没了，怎么找回",
  "想转产品经理，但不知道从哪开始","每天加班到十点，阅读时间从哪挤",
  "读了很多书，但记不住也用不上","同龄人都升职了，我还在原地",
  "想做一个副业，但不知道选什么方向","职业选择和父母期待冲突",
  "读研还是工作，两条路都不敢选","在大厂做螺丝钉，看不到全貌",
  "想回二线城市，但怕机会少","面试总在最后一轮被刷，不知道差在哪",
  "技术更新太快，学不过来","和领导沟通总是说不到点上",
  "想创业但没有任何资源","工作内容和专业不对口",
  "30岁还没有清晰的职业方向","害怕被AI取代",
  "每天都在忙，但不知道忙什么","想换行业，但舍不得现在的积累",
  "团队里没人愿意承担责任","想读书但不知道读什么",
  "读完书不知道怎么用到工作里","想认识同行业的人，但不知道从哪开始",
  "职业倦怠期，每天早上不想上班","想做自由职业，但怕没有稳定收入",
  "学历不够，晋升被卡","想找一个能长期投入的方向",
];
export const PLAYBOOKS = [
  { name: "文学谁是卧底", category: "破冰", durationMin: 25, materials: "词卡 20 张（《红楼梦》vs《西厢记》等名著组）", suitableCrowd: "8 人以上，有基础阅读量", source: "宁波霞浦「文学版谁是卧底」", rules: "每人抽词卡，用一句话描述不含书名；每轮投票淘汰一人，平民全灭或卧底找出即结束。" },
  { name: "Emoji 猜书名", category: "破冰", durationMin: 15, materials: "投影或手机，题库 30 题", suitableCrowd: "不限，零门槛", source: "南京「和春天阅个会」", rules: "屏幕出一组 Emoji，抢答对应书名；答对积一分，三局定胜负。" },
  { name: "拼贴诗工坊", category: "共鸣", durationMin: 40, materials: "旧书页、报纸、剪刀、胶水、A4 卡纸", suitableCrowd: "不限，表达欲强的人", source: "上海「欢迎你做一页诗人」", rules: "从旧文字里剪下词句，拼成一页诗；最后每人朗读并讲一句为什么这样拼。" },
  { name: "故事接龙", category: "共鸣", durationMin: 30, materials: "无（一页纸记线索）", suitableCrowd: "6–12 人", source: "通用玩法", rules: "第一人用书名开头说一句，后续每人接一句；三轮后回看故事走向。" },
  { name: "书缘盲盒", category: "建联", durationMin: 20, materials: "牛皮纸、麻绳、一本书", suitableCrowd: "不限", source: "湖北「缘来是你·阅见知己」", rules: "每人带一本想送出的书，包成盲盒写一句推荐；抽签交换，拆开后才知对方是谁。" },
  { name: "以书换书", category: "建联", durationMin: 30, materials: "自带来回的书（每人 1–2 本）", suitableCrowd: "不限", source: "通用玩法", rules: "摆放成书摊，每人讲 30 秒为什么值得换；自由交换，成交要合影。" },
  { name: "击鼓传书", category: "破冰", durationMin: 15, materials: "一本书、背景音乐", suitableCrowd: "10 人以上", source: "湖北「击鼓传书」", rules: "音乐响传书，停则持书者抽一个问题回答；问题来自本场问题云。" },
  { name: "封面侦探", category: "破冰", durationMin: 20, materials: "书封图片 20 张（去书名）", suitableCrowd: "不限", source: "通用玩法", rules: "只给封面猜书名与作者；猜中讲一句你对这本书的印象。" },
  { name: "文学迷宫", category: "共鸣", durationMin: 35, materials: "题库、路线卡、计分板", suitableCrowd: "8 人以上", source: "湖北「文学迷宫」", rules: "分小组走迷宫，每格一道文学题；答对前进，答错停一轮，先到终点者胜。" },
];
export const MAIN_ACTIVITY = {
  type: "topic",
  title: "五道口青年场 · 职业迷茫：我到底该往哪走",
  bookTitle: "世界尽头的咖啡馆",
  bookAuthor: "约翰·史崔勒基",
  topic: "职业迷茫",
  district: "海淀 · 五道口",
  venue: "五道口某咖啡馆（闲时）",
  capacity: 50,
  status: "draft",
  demandText: "11月中旬·海淀·五道口·50人青年场·议题：职业迷茫·书：《世界尽头的咖啡馆》·场地：某咖啡馆闲时",
  plannedInDays: 15,
};
export const HISTORY_ACTIVITIES = [
  { type: "coread", title: "学院路共读场 · 《局外人》", bookTitle: "局外人", bookAuthor: "阿尔贝·加缪", topic: "荒诞与日常", district: "海淀 · 学院路", venue: "学院路街道新时代文明实践站", capacity: 40, status: "settled", daysAgo: 48 },
  { type: "industry", title: "中关村行业场 · 互联网人的 35 岁", bookTitle: "置身事内", bookAuthor: "兰小欢", topic: "职业转型", district: "海淀 · 中关村", venue: "中关村创业大街会议室", capacity: 30, status: "settled", daysAgo: 28 },
  { type: "topic", title: "五道口议题场 · 如何成为内核稳定的人", bookTitle: "被讨厌的勇气", bookAuthor: "岸见一郎 / 古贺史健", topic: "内核稳定", district: "海淀 · 五道口", venue: "五道口某咖啡馆（闲时）", capacity: 50, status: "settled", daysAgo: 9 },
];
export const METRICS = [
  { activityIndex: 0, attendees: 32, satisfaction: 4.7, playbookRetention: 0.62 },
  { activityIndex: 1, attendees: 27, satisfaction: 4.5, playbookRetention: 0.55 },
  { activityIndex: 2, attendees: 46, satisfaction: 4.8, playbookRetention: 0.71 },
];
export const AGE_DIST = { "20-25": 0.34, "26-30": 0.41, "31-35": 0.18, "36-45": 0.07 };
export const HISTORY_POSTS = [
  { activityIndex: 0, channelSlug: "reading", authorName: "林间", authorRole: "领读人", title: "我们害怕的不是荒诞，是别人觉得我们不够努力", body: "「今天，妈妈死了。也可能是昨天，我不知道。」\n\n我们围着这句话聊了两个小时。有人说是冷漠，有人说是诚实。最后一位做产品的朋友说：我们害怕的不是生活没有意义，是身边的人觉得我们过得没有意义。\n\n散场时外面在下雨，三个人没带伞，站在门口又聊了二十分钟。", labels: ["共读复盘", "加缪"] },
  { activityIndex: 0, channelSlug: "reading", authorName: "小满", authorRole: "读者", title: "一页拼贴诗：把书页剪成自己的句子", body: "「把 日子 折 成 一 封 没 有 收 件 人 的 信\n风 替 我 盖 了 邮 戳」\n\n现场用旧书页拼的。第一次觉得读书会的产出可以不是笔记。", labels: ["拼贴诗", "作品"] },
  { activityIndex: 1, channelSlug: "reading", authorName: "陈默", authorRole: "共创者", title: "35 岁不是年龄，是一个被反复提起的截止日期", body: "行业场来了 27 个人，一半在互联网，一半刚离开。\n\n我们聊的不是「如何不被淘汰」，而是「如果不再做这行，我还剩下什么」。这个问题比前者难回答得多，但至少诚实。", labels: ["行业场", "35岁"] },
  { activityIndex: 2, channelSlug: "reading", authorName: "周雨", authorRole: "领读人", title: "稳定不是没有情绪，是情绪来了你知道它从哪来", body: "这场来了 46 人，问题云里问得最多的是「怎么才能不在意别人的评价」。\n\n我们没有给出答案，只做了一件事：让每个人把最近一次情绪失控的场景写下来，再读给别人听。读完之后，有两个人说「原来我不是一个人」。", labels: ["议题场", "内核稳定"] },
  { activityIndex: 2, channelSlug: "reading", authorName: "阿冗", authorRole: "读者", title: "来之前以为会尴尬，结果第一个发言了", body: "我本来只打算坐角落听。破冰玩的是击鼓传书，书停在我手上，抽到的问题是「你最近一次想辞职是因为什么」。\n\n我说完之后，对面的人说他也一样。", labels: ["破冰", "现场"] },
];
