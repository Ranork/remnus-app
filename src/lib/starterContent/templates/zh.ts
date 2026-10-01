import type { TemplateText } from '../types';

const text: TemplateText = {
  stock: {
    title: '标题',
    status: '状态',
    id: 'ID',
    todo: '待办',
    inProgress: '进行中',
    done: '已完成',
  },
  views: { table: '表格', board: '看板', calendar: '日历' },

  meetingNotes: `## 参会人员

- Sarah Chen（产品经理）
- Marcus Johnson（工程负责人）
- Aisha Patel（设计师）

## 议程

1. 冲刺回顾与速率检查
2. 第三季度路线图优先级
3. 设计系统更新

## 记录

本次冲刺整体顺利，速率略高于预估。新的登录流程已上线，运行符合预期。

第三季度优先事项：重点改进新用户引导和移动端适配。市场部需要在 7 月底前拿到新的仪表板。

设计系统：Aisha 下周会分享更新后的组件库。

## 待办事项

- [ ] Marcus：周五前搭好预发布环境
- [ ] Aisha：下周二前分享设计系统 v2 草稿
- [ ] Sarah：把第三季度路线图草稿发给团队评审
`,

  projectBrief: `## 概述

一款新一代分析仪表板，帮助团队实时跟踪关键指标。目标是用集中化、自动化的方案取代现有基于电子表格的报表。

## 目标

- 将手工制作报表的时间减少 80%
- 实时呈现团队 KPI
- 支持将数据导出为 PDF 和 CSV

## 时间线

| 里程碑 | 日期 |
|--------|------|
| 启动 | 2026 年 6 月 2 日 |
| 设计完成 | 2026 年 6 月 20 日 |
| Beta 发布 | 2026 年 7 月 15 日 |
| 正式上线 | 2026 年 8 月 1 日 |

## 团队

- 产品：Sarah Chen
- 工程：Marcus Johnson、Kai Rivera
- 设计：Aisha Patel
`,

  taskTracker: {
    columns: { priority: '优先级', assignee: '负责人', dueDate: '截止日期' },
    status: { backlog: '待处理', inProgress: '进行中', review: '评审中', done: '已完成' },
    priority: { low: '低', medium: '中', high: '高' },
    rows: {
      landing: '设计落地页原型',
      ci: '搭建 CI/CD 流水线',
      tests: '为认证模块编写单元测试',
      review: 'feature/payments 分支代码评审',
      docs: '更新 API 文档',
      staging: '部署到预发布环境',
      loginBug: '修复登录重定向问题',
    },
  },

  eventCalendar: {
    columns: { eventDate: '活动日期', category: '类别', notes: '备注' },
    category: { meeting: '会议', conference: '大会', deadline: '截止日期', personal: '个人' },
    rows: {
      standup: { title: '每周团队站会', notes: '每周一例行' },
      planning: { title: '冲刺规划', notes: '第 14 个冲刺启动' },
      productReview: { title: '第三季度产品评审', notes: '与相关方一起评审路线图' },
      mvp: { title: '项目 MVP 截止', notes: '所有功能都必须合并到 main' },
      summit: { title: 'Frontend Summit 2026', notes: '线上参加，在 frontendsummit.io 报名' },
      handoff: { title: '设计系统交付', notes: 'Aisha 交付 v2 组件' },
      offsite: { title: '团队外出团建', notes: '伊斯坦布尔，住 2 晚' },
    },
  },

  readingList: {
    columns: { rating: '评分', genre: '类型', author: '作者' },
    status: { wantToRead: '想读', reading: '在读', done: '读过' },
    genre: { fiction: '小说', nonFiction: '非虚构', tech: '技术', science: '科学' },
    books: {
      pragmatic: '程序员修炼之道',
      dune: '沙丘',
      sapiens: '人类简史',
      cleanCode: '代码整洁之道',
      threeBody: '三体',
      briefHistory: '时间简史',
      thinking: '思考，快与慢',
    },
  },

  agentMemory: {
    columns: { type: '类型', tags: '标签', date: '日期' },
    type: { decision: '决定', preference: '偏好', gotcha: '坑', fact: '事实' },
    tags: { architecture: '架构', conventions: '约定', api: 'api', database: '数据库', infra: '基础设施' },
    byType: '按类型',
    rows: {
      postgres: '主数据存储使用 PostgreSQL',
      functional: 'React 优先使用函数组件，而不是类组件',
      rateLimit: '预发布 API 限流为每分钟 100 次请求，写入请批量进行',
      tokens: '设计令牌放在 tokens.css 中，而不是 Tailwind 配置里',
    },
  },
};

export default text;
