import { doFetchNotInterested } from '../commons/fetch';
import { CTZ_HIDDEN_ITEM_CLASS, fnHidden, fnJustNum } from '../commons/math-for-my-listens';
import { myStorage } from '../commons/storage';
import { createButtonFontSize12, dom, domA, domP, fnLog } from '../commons/tools';
import { CLASS_LISTENED, CLASS_NOT_INTERESTED, CLASS_TO_QUESTION, FILTER_FOLLOWER_OPERATE } from '../configs';
import { store } from '../store';
import { EThemeDark, EThemeLight, IZhihuCardContent, IZhihuDataZop } from '../types';
import { doHighlightOriginal } from './background';

/** 监听列表内容 - 过滤  */
export const myListenListItem = {
  initTimestamp: 0,
  init: async function () {
    const nodeLoading = dom('.Topstory-recommend .List-item.List-item');
    const currentTime = +new Date();
    // 存在此元素时为加载数据状态，半秒钟后再次加载
    // 时间戳添加，解决重置问题
    if (nodeLoading || currentTime - this.initTimestamp < 500) {
      setTimeout(() => this.init(), 500);
      return;
    }
    this.initTimestamp = currentTime;

    await this.traversal(domA(`.TopstoryItem:not(.${CLASS_LISTENED})`));
    setTimeout(async () => {
      await this.traversal(domA(`.TopstoryItem:not(.${CLASS_LISTENED})`)); // 每次执行后检测未检测到的项，解决内容重载的问题
    }, 500);
    await recommendHighPerformance();
  },
  traversal: async function (nodes: HTMLElement[]) {
    if (!nodes.length) return;
    const userinfo = store.getUserinfo();
    const removeRecommends = store.getRemoveRecommends();
    const pfConfig = await myStorage.getConfig();
    const {
      filterKeywords = [],
      blockWordsAnswer = [],
      removeItemAboutVideo,
      removeItemAboutPin,
      removeItemAboutArticle,
      removeLessVote,
      lessVoteNumber = 0,
      removeItemQuestionAsk,
      removeFollowVoteAnswer,
      removeFollowVoteArticle,
      removeFollowFQuestion,
      listOutPutNotInterested,
      highlightOriginal,
      backgroundHighlightOriginal,
      themeDark = EThemeDark.深色一,
      themeLight = EThemeLight.默认,
      removeMyOperateAtFollow,
      listOutputToQuestion,
      fetchInterceptStatus,
      removeBlockUserContent,
      blockedUsers,
    } = pfConfig;
    const pfHistory = await myStorage.getHistory();
    const historyList = pfHistory.list;
    let removeUsernames: string[] = [];
    removeBlockUserContent && (removeUsernames = (blockedUsers || []).map((i) => i.name || ''));

    const highlight = await doHighlightOriginal(backgroundHighlightOriginal, themeDark, themeLight);
    for (let i = 0, len = nodes.length; i < len; i++) {
      const nodeItem = nodes[i];
      if (nodeItem.classList.contains(CTZ_HIDDEN_ITEM_CLASS)) continue;
      nodeItem.classList.add(CLASS_LISTENED);
      nodeItem.dataset.code = `${+new Date()}-${i}`; // 添加唯一标识
      const nodeContentItem = nodeItem.querySelector('.ContentItem');
      if (!nodeItem.scrollHeight || !nodeContentItem) continue;
      let message = ''; // 屏蔽信息
      let dataZop: IZhihuDataZop = {};
      let cardContent: IZhihuCardContent = {};
      /** 是否视频回答 */
      const isVideo = nodeContentItem.classList.contains('ZVideoItem');
      /** 是否文章 */
      const isArticle = nodeContentItem.classList.contains('ArticleItem');
      /** 是否想法 */
      const isTip = nodeContentItem.classList.contains('PinItem');
      try {
        dataZop = JSON.parse(nodeContentItem.getAttribute('data-zop') || '{}');
        cardContent = JSON.parse(nodeContentItem.getAttribute('data-za-extra-module') || '{}').card.content;
      } catch {}
      const { title = '', itemId, authorName } = dataZop || {};
      // 关注列表屏蔽自己的操作
      if (removeMyOperateAtFollow && nodeItem.classList.contains('TopstoryItem-isFollow')) {
        try {
          const findUserId = (nodeItem.querySelector('.UserLink .UserLink-link') as HTMLAnchorElement).href.match(/[^\/]+$/)![0];
          const myUserId = userinfo!.url.match(/[^\/]+$/)![0];
          findUserId === myUserId && (message = '关注列表屏蔽自己的操作');
        } catch {}
      }

      // 屏蔽盐选等...
      if (!message) {
        const removeItem = removeRecommends.find((i) => i.id === String(itemId));
        removeItem && (message = `推荐列表已屏蔽${removeItem.message}: ${title}`);
      }

      // 屏蔽用户的内容
      if (!message) {
        removeUsernames.includes(authorName || '') && (message = `已删除${dataZop.authorName}的内容: ${title}`);
      }

      // 列表种类过滤
      if (!message && ((isVideo && removeItemAboutVideo) || (isArticle && removeItemAboutArticle) || (isTip && removeItemAboutPin))) {
        message = `列表种类屏蔽，${nodeContentItem.classList.value}`;
      }
      // 屏蔽低赞内容
      if (!message && removeLessVote && (cardContent['upvote_num'] || 0) < lessVoteNumber) {
        message = `屏蔽低赞内容: ${title}, ${cardContent['upvote_num'] || 0}`;
      }
      // 屏蔽邀请回答
      if (!message && removeItemQuestionAsk && nodeItem.querySelector('.TopstoryQuestionAskItem')) {
        message = '屏蔽邀请回答';
      }
      // 关注列表屏蔽关注人操作
      if (!message && (removeFollowVoteAnswer || removeFollowVoteArticle || removeFollowFQuestion) && nodeItem.classList.contains('TopstoryItem-isFollow')) {
        const nodeFirstLine = nodeItem.querySelector('.FeedSource-firstline') as HTMLElement;
        const textFollowerOperate = nodeFirstLine ? nodeFirstLine.innerText : '';
        for (let itemOperate of FILTER_FOLLOWER_OPERATE) {
          const thisRep = new RegExp(itemOperate.rep);
          if (pfConfig[itemOperate.key] && thisRep.test(textFollowerOperate)) {
            message = `屏蔽关注人操作: ${textFollowerOperate}`;
            break;
          }
        }
      }
      // 标题屏蔽词过滤
      !message && (message = this.replaceBlockWord(title, nodeContentItem, filterKeywords, title, '标题'));
      // 内容屏蔽词过滤
      if (!message) {
        const domRichContent = nodeItem.querySelector('.RichContent');
        const innerText = domRichContent ? (domRichContent as HTMLElement).innerText : '';
        message = this.replaceBlockWord(innerText, nodeContentItem, blockWordsAnswer, title, '内容');
      }

      if (message) {
        // 是否需要隐藏元素
        fnHidden(nodeItem, message);
        const { itemId, type } = dataZop;
        doFetchNotInterested({ id: `${itemId || ''}`, type: `${type}` });
      } else {
        // 未隐藏的元素需添加的内容
        // 高亮原创
        const userNameE = nodeItem.querySelector('.FeedSource-firstline .UserLink-link') as HTMLElement;
        const userName = userNameE ? userNameE.innerText : '';
        if (dataZop && dataZop.authorName === userName) {
          const nodeActions = nodeItem.querySelector('.ContentItem-actions') as HTMLElement;
          nodeItem.style.cssText = highlightOriginal ? `${highlight}border: 1px solid #aaa;` : '';
          nodeActions && (nodeActions.style.cssText = highlightOriginal ? highlight : '');
        }

        const nodeItemTitle = nodeItem.querySelector('.ContentItem-title');
        if (nodeItemTitle) {
          // 列表外置不感兴趣按钮
          if (listOutPutNotInterested && fetchInterceptStatus && !nodeItem.querySelector(`.${CLASS_NOT_INTERESTED}`)) {
            nodeItemTitle.appendChild(createButtonFontSize12('不感兴趣', CLASS_NOT_INTERESTED, { _params: { id: dataZop.itemId, type: dataZop.type } }));
          }
          // 推荐列表显示「直达问题」按钮
          if (listOutputToQuestion && !isVideo && !isArticle && !isTip && !nodeItem.querySelector(`.${CLASS_TO_QUESTION}`)) {
            const domUrl = nodeContentItem.querySelector('[itemprop="url"]');
            const pathAnswer = domUrl ? domUrl.getAttribute('content') || '' : '';
            nodeItemTitle.appendChild(createButtonFontSize12('直达问题', CLASS_TO_QUESTION, { _params: { path: pathAnswer.replace(/\/answer[\W\w]+/, '') } }));
          }
        }
      }
      // 缓存推荐列表
      if (domP(nodeItem, 'class', 'Topstory-recommend') && nodeItem.querySelector('.ContentItem-title a')) {
        const nodeA = nodeItem.querySelector('.ContentItem-title a') as HTMLAnchorElement;
        if (nodeA) {
          const typeObj = isVideo ? RECOMMEND_TYPE.zvideo : isArticle ? RECOMMEND_TYPE.article : isTip ? RECOMMEND_TYPE.pin : RECOMMEND_TYPE.answer;
          const historyItem = `<a href="${nodeA.href}" target="_blank"><b style="${typeObj.style}">「${typeObj.name}」</b>${nodeA.innerText}</a>`;
          !historyList.includes(historyItem) && historyList.unshift(historyItem);
        }
      }
      fnJustNum(nodeItem);
      if (i === len - 1) {
        myStorage.updateHistoryItem('list', historyList);
      }
    }
  },
  reset: function () {
    domA(`.TopstoryItem.${CLASS_LISTENED}`).forEach((item) => {
      item.classList.remove(CLASS_LISTENED);
    });
  },
  restart: function () {
    this.reset();
    this.init();
  },
  replaceBlockWord: function (innerText: string, nodeItemContent: Element, blockWords: string[], title: string, byWhat: string) {
    if (innerText) {
      let matchedWord = '';
      for (let word of blockWords) {
        const rep = new RegExp(word.toLowerCase());
        if (rep.test(innerText.toLowerCase())) {
          matchedWord += `「${word}」`;
          break;
        }
      }
      if (matchedWord) {
        const elementItemProp = nodeItemContent.querySelector('[itemprop="url"]');
        const routeURL = elementItemProp && elementItemProp.getAttribute('content');
        return `${byWhat}屏蔽词匹配，匹配内容：${matchedWord}，《${title}》，链接：${routeURL}`;
      }
    }
    return '';
  },
};

const RECOMMEND_TYPE = {
  answer: {
    name: '问题',
    style: 'color: #ec7259',
  },
  article: {
    name: '文章',
    style: 'color: #00965e',
  },
  zvideo: {
    name: '视频',
    style: 'color: #12c2e9',
  },
  pin: {
    name: '想法',
    style: 'color: #9c27b0',
  },
};

/** 高性能模式处理列表 */
const recommendHighPerformance = async () => {
  const { highPerformanceRecommend } = await myStorage.getConfig();
  if (!highPerformanceRecommend) return;
  setTimeout(() => {
    const nodes = domA(`.${CLASS_LISTENED}`);
    if (nodes.length > 50) {
      // 查找最后一个元素显示位置，并在删除最前方元素后将页面位置调整回删除前，解决闪烁问题
      const nodeLast = nodes[nodes.length - 1];
      /** 删除前最后一个元素的位置 */
      const yLastPrev = nodeLast.offsetTop;
      /** 当前页面滚动位置 */
      const yDocument = document.documentElement.scrollTop;
      /** 获取定位元素的唯一标识，通过唯一标识在删除元素后重新获取，解决只获取最后一个元素时已经有新元素添加进来导致的位置错误的情况 */
      const code = nodeLast.dataset.code;

      const nIndex = nodes.length - 50;
      nodes.forEach((item, index) => {
        index < nIndex && item.remove();
      });

      const nNodeLast = dom(`[data-code="${code}"]`);
      if (nNodeLast) {
        /** 删除元素后最后一个元素的位置 */
        const nYLast = nNodeLast.offsetTop;
        // 原页面滚动位置减去最后一个元素位置的差值，得出新的位置，解决闪烁问题
        window.scrollTo({ top: yDocument - (yLastPrev - nYLast) });
      }

      fnLog(`已开启高性能模式，删除${nIndex}条推荐内容`);
    }
  }, 100);
};
