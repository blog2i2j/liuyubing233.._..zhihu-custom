import { myStorage } from '../commons/storage';
import { dom, domA, domById, domC, message } from '../commons/tools';
import { CLASS_INPUT_CHANGE, CLASS_INPUT_CLICK, CLASS_SELECT, CONFIG_DEFAULT, CONFIG_SIMPLE } from '../configs';
import { myCustomStyle } from '../methods/background';
import { syncBlackList, syncRemoveBlockedUsers } from '../methods/blocked-users';
import { fnChanger } from '../methods/fn-changer';
import { echoHistory } from '../methods/history';
import { onChangeMenu } from '../methods/menu';
import { moveAndOpen } from '../methods/move';
import { openChange } from '../methods/open';
import { changeTitle } from '../methods/page-title';
import { myPreview } from '../methods/preview';
import { formatTime } from '../methods/time';
import { store } from '../store';
import { IKeyofHistory } from '../types';
import { initRootEvent } from './init-top-event-listener';

/** 加载设置弹窗绑定方法 */
export const initOperate = () => {
  const nodeContent = domById('CTZ_DIALOG')!;
  nodeContent.onclick = (e) => {
    const target = e.target as HTMLInputElement;
    if (target.classList.contains(CLASS_INPUT_CLICK)) {
      fnChanger(target);
      return;
    }

    if (target.classList.contains('ctz-reset-font-size')) {
      // 字体大小重置
      const inputName = target.name.replace('reset-', '');
      const nodeInput = dom(`[name="${inputName}"]`) as HTMLInputElement;
      nodeInput.value = '';
      fnChanger(nodeInput);
      return;
    }

    if (target.classList.contains('ctz-button')) {
      myButtonOperation[target.name] && myButtonOperation[target.name]();
      return;
    }
  };
  nodeContent.onchange = (e) => {
    const target = e.target as HTMLInputElement;
    if (target.classList.contains(CLASS_INPUT_CHANGE) || target.classList.contains(CLASS_SELECT)) {
      fnChanger(target);
      return;
    }
    if (target.classList.contains('ctz-input-config-import')) {
      configImport(e);
      return;
    }
  };

  dom('#CTZ_DIALOG_MENU')!.onclick = onChangeMenu;
  domA('.ctz-preview').forEach((item) => {
    item.onclick = function () {
      myPreview.hide(this);
    };
  });

  domA('[name="button_history_clear"]').forEach((item) => {
    item.onclick = async (event) => {
      const prevHistory = await myStorage.getHistory();
      const target = event.target as HTMLElement;
      const dataId = target.getAttribute('data-id') as IKeyofHistory;
      const isClear = confirm(`是否清空${target.innerText}`);
      if (!isClear) return;
      prevHistory[dataId] = [];
      await myStorage.updateHistory(prevHistory);
      echoHistory();
    };
  });

  moveAndOpen();
  initRootEvent();
};

/** 编辑器弹窗按钮点击事件集合 */
const myButtonOperation: Record<string, Function> = {
  // 导出配置
  configExport: async () => {
    const config = (await myStorage.get('pfConfig')) || '{}';
    const dateNumber = +new Date();
    const link = domC('a', {
      href: 'data:text/csv;charset=utf-8,\ufeff' + encodeURIComponent(config),
      download: `知乎编辑器配置-${formatTime(dateNumber, 'YYYY-MM-DD_HH-mm-ss')}-${dateNumber}.txt`,
    });
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  },
  // 清空配置
  configRemove: async () => {
    GM.deleteValue('pfConfig');
    localStorage.removeItem('pfConfig');
  },
  // 恢复默认配置
  configReset: async function () {
    const isUse = confirm('是否启恢复默认配置？\n该功能会覆盖当前配置，建议先将配置导出保存');
    if (!isUse) return;
    const { filterKeywords = [], blockedUsers = [] } = await myStorage.getConfig();
    await myStorage.updateConfig({
      ...CONFIG_DEFAULT,
      filterKeywords,
      blockedUsers,
    });
    setTimeout(() => {
      location.reload();
    }, 300);
  },
  // 自定义样式
  styleCustom: async function () {
    const nodeText = dom('[name="textStyleCustom"]') as HTMLInputElement;
    const value = nodeText ? nodeText.value : '';
    await myStorage.updateConfigItem('customizeCss', value);
    myCustomStyle.change(value);
  },
  // 同步黑名单
  syncBlack: () => syncBlackList(0),
  // 清空黑名单列表
  syncBlackRemove: () => syncRemoveBlockedUsers(),
  /** 确认更改网页标题 */
  buttonConfirmTitle: async function () {
    const nodeTitle = dom('[name="globalTitle"]') as HTMLInputElement;
    await myStorage.updateConfigItem('globalTitle', nodeTitle ? nodeTitle.value : '');
    changeTitle();
    message('网页标题修改成功');
  },
  /** 还原网页标题 */
  buttonResetTitle: async function () {
    const { getStorageConfigItem } = store;
    const nodeTitle = dom('[name="globalTitle"]') as HTMLInputElement;
    nodeTitle && (nodeTitle.value = getStorageConfigItem('cacheTitle') as string);
    await myStorage.updateConfigItem('globalTitle', '');
    changeTitle();
    message('网页标题已还原');
  },
  // 导入配置
  configImport: () => {
    dom('#IMPORT_BY_FILE input')!.click();
  },
  // 关闭修改器弹窗
  dialogClose: openChange,
  // 放大缩小修改器弹窗
  dialogBig: () => {
    const nodeDialog = domById('CTZ_DIALOG')!;
    const isHeight = nodeDialog.style.height === '100vh';
    nodeDialog.style.height = isHeight ? '' : '100vh';
    dom(`button[name="dialogBig"]`)!.innerText = isHeight ? '+' : '-';
  },
  // 启用极简模式
  useSimple: async () => {
    const isUse = confirm('是否启用极简模式？\n该功能会覆盖当前配置，建议先将配置导出保存');
    if (!isUse) return;
    const prevConfig = await myStorage.getConfig();
    myStorage.updateConfig({
      ...prevConfig,
      ...CONFIG_SIMPLE,
    });
    setTimeout(() => {
      location.reload();
    }, 300);
  },
};

/** 配置导入文件方法 */
const configImport = (e: Event) => {
  const target = e.target as HTMLInputElement;
  const configFile = (target.files || [])[0];
  if (!configFile) return;
  const reader = new FileReader();
  reader.readAsText(configFile);
  reader.onload = async (oFREvent) => {
    let config = oFREvent.target ? oFREvent.target.result : '';
    if (typeof config === 'string') {
      const nConfig = JSON.parse(config);
      await myStorage.updateConfig(nConfig);
      setTimeout(() => {
        location.reload();
      }, 300);
    }
  };
  target.value = '';
};
