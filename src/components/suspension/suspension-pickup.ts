import { dom, myStorage } from '../../tools';
import { changeSizeBeforeResize } from '../size';

/** 长回答和列表收起按钮悬浮 */
export const suspensionPickupAttribute = async () => {
  const { suspensionPickUp } = await myStorage.getConfig();
  if (suspensionPickUp) {
    dom('body')!.setAttribute('data-suspension-pickup', 'true');
  } else {
    dom('body')!.removeAttribute('data-suspension-pickup');
  }
  // mySize.change();
  changeSizeBeforeResize();
};
