import { CLASS_TIME_ITEM } from '../misc';
import { dom, domC, formatTime, myStorage } from '../tools';

/** 问题添加时间 */
export const updateItemTime = (e: HTMLElement) => {
  const nodeCreated = e.querySelector('[itemprop="dateCreated"]') as HTMLMetaElement;
  const nodePublished = e.querySelector('[itemprop="datePublished"]') as HTMLMetaElement;
  const nodeModified = e.querySelector('[itemprop="dateModified"]') as HTMLMetaElement;
  const crTime = nodeCreated ? nodeCreated.content : '';
  const puTime = nodePublished ? nodePublished.content : '';
  const muTime = nodeModified ? nodeModified.content : '';
  const timeCreated = formatTime(crTime || puTime);
  const timeModified = formatTime(muTime);
  const nodeBox = e.querySelector('.ContentItem-meta');
  if (!timeCreated || !nodeBox) return;
  const innerHTML = `<div>创建时间：${timeCreated}</div><div>最后修改时间：${timeModified}</div>`;
  const domTime = e.querySelector(`.${CLASS_TIME_ITEM}`);
  if (domTime) {
    domTime.innerHTML = innerHTML;
  } else {
    nodeBox.appendChild(
      domC('div', {
        className: CLASS_TIME_ITEM,
        innerHTML,
        style: 'line-height: 24px;padding-top: 2px;font-size: 14px;',
      })
    );
  }
};

let questionTimeout: NodeJS.Timeout;
let questionFindIndex = 0;
const resetQuestionTime = () => {
  if (questionFindIndex > 5 || !dom('.ctz-question-time')) {
    return;
  }
  questionFindIndex++;
  clearTimeout(questionTimeout);
  questionTimeout = setTimeout(addQuestionTime, 500);
};

/** 问题详情添加时间 */
export const addQuestionTime = async () => {
  const nodeTime = dom('.ctz-question-time');
  nodeTime && nodeTime.remove();
  const { questionCreatedAndModifiedTime } = await myStorage.getConfig();
  const nodeCreated = dom('[itemprop="dateCreated"]') as HTMLMetaElement;
  const nodeModified = dom('[itemprop="dateModified"]') as HTMLMetaElement;
  const nodeBox = dom('.QuestionPage .QuestionHeader-title');
  if (!questionCreatedAndModifiedTime || !nodeCreated || !nodeModified || !nodeBox) {
    resetQuestionTime();
    return;
  }
  nodeBox && nodeBox.appendChild(
    domC('div', {
      className: 'ctz-question-time',
      innerHTML: `<div>创建时间：${formatTime(nodeCreated.content)}</div><div>最后修改时间：${formatTime(nodeModified.content)}</div>`,
    })
  );
  resetQuestionTime();
};

const C_ARTICLE_TIME = 'ctz-article-time';
/** 文章发布时间置顶 */
export const addArticleTime = async () => {
  const { articleCreateTimeToTop } = await myStorage.getConfig();
  const nodeT = dom(`.${C_ARTICLE_TIME}`);
  if (nodeT) return;
  const nodeContentTime = dom('.ContentItem-time');
  const nodeBox = dom('.Post-Header');
  if (!articleCreateTimeToTop || !nodeContentTime || !nodeBox) return;
  nodeBox.appendChild(
    domC('span', {
      className: C_ARTICLE_TIME,
      style: 'color: #8590a6;line-height: 30px;',
      innerHTML: nodeContentTime.innerText || '',
    })
  );
  setTimeout(() => {
    // 解决页面重载问题
    addArticleTime();
  }, 500);
};
