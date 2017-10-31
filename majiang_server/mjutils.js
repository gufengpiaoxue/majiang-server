let kanzi = [];
const record = false;
function debugRecord(pai) {
  if (record) {
    kanzi.push(pai);
  }
}

function checkCanHu(seatData) {
  const { countMap } = seatData;
  return Object.keys(countMap).some((v) => {
    const k = parseInt(v, 10);
    const c = seatData.countMap[k];
    if (c < 2) {
      return false;
    }
    // 如果当前牌大于等于２，则将它选为将牌
    countMap[k] -= 2;
    // 逐个判定剩下的牌是否满３Ｎ规则,一个牌会有以下几种情况
    // 1、0张，则不做任何处理
    // 2、2张，则只可能是与其它牌形成匹配关系
    // 3、3张，则可能是单张形成 A-2,A-1,A  A-1,A,A+1  A,A+1,A+2，也可能是直接成为一坎
    // 4、4张，则只可能是一坎+单张
    kanzi = [];
    const ret = checkSingle(seatData);
    countMap[k] += 2;
    return ret;
  });
}


function checkTingPai(seatData1, begin, end) {
  const seatData = seatData1;
  for (let i = begin; i < end; i += 1) {
    // 如果这牌已经在和了，就不用检查了
    if (seatData.tingMap[i] != null) {
      continue;
    }
    // 将牌加入到计数中
    let old = seatData.countMap[i];
    if (old == null) {
      old = 0;
      seatData.countMap[i] = 1;
    } else {
      seatData.countMap[i] += 1;
    }

    seatData.holds.push(i);
    // 逐个判定手上的牌
    const ret = checkCanHu(seatData);
    if (ret) {
      // 平胡 0番
      seatData.tingMap[i] = {
        pattern: 'normal',
        fan: 0
      };
    }

    // 搞完以后，撤消刚刚加的牌
    seatData.countMap[i] = old;
    seatData.holds.pop();
  }
}

function matchSingle(seatData1, selected) {
  const seatData = seatData1;
  // 分开匹配 A-2,A-1,A
  let matched = true;
  const v = selected % 9;
  if (v < 2) {
    matched = false;
  } else {
    for (let i = 0; i < 3; i += 1) {
      const t = selected - 2 + i;
      const cc = seatData.countMap[t];
      if (cc == null) {
        matched = false;
        break;
      }
      if (cc === 0) {
        matched = false;
        break;
      }
    }
  }

  // 匹配成功，扣除相应数值
  if (matched) {
    seatData.countMap[selected - 2] -= 1;
    seatData.countMap[selected - 1] -= 1;
    seatData.countMap[selected] -= 1;
    const ret = checkSingle(seatData);
    seatData.countMap[selected - 2] += 1;
    seatData.countMap[selected - 1] += 1;
    seatData.countMap[selected] += 1;
    if (ret === true) {
      debugRecord(selected - 2);
      debugRecord(selected - 1);
      debugRecord(selected);
      return true;
    }
  }

  // 分开匹配 A-1,A,A + 1
  matched = true;
  if (v < 1 || v > 7) {
    matched = false;
  } else {
    for (let i = 0; i < 3; i += 1) {
      const t = selected - 1 + i;
      const cc = seatData.countMap[t];
      if (cc == null) {
        matched = false;
        break;
      }
      if (cc == 0) {
        matched = false;
        break;
      }
    }
  }

  // 匹配成功，扣除相应数值
  if (matched) {
    seatData.countMap[selected - 1] -= 1;
    seatData.countMap[selected] -= 1;
    seatData.countMap[selected + 1] -= 1;
    const ret = checkSingle(seatData);
    seatData.countMap[selected - 1] += 1;
    seatData.countMap[selected] += 1;
    seatData.countMap[selected + 1] += 1;
    if (ret === true) {
      debugRecord(selected - 1);
      debugRecord(selected);
      debugRecord(selected + 1);
      return true;
    }
  }

  // 分开匹配 A,A+1,A + 2
  matched = true;
  if (v > 6) {
    matched = false;
  } else {
    for (let i = 0; i < 3; i += 1) {
      const t = selected + i;
      const cc = seatData.countMap[t];
      if (cc == null) {
        matched = false;
        break;
      }
      if (cc === 0) {
        matched = false;
        break;
      }
    }
  }

  // 匹配成功，扣除相应数值
  if (matched) {
    seatData.countMap[selected] -= 1;
    seatData.countMap[selected + 1] -= 1;
    seatData.countMap[selected + 2] -= 1;
    const ret = checkSingle(seatData);
    seatData.countMap[selected] += 1;
    seatData.countMap[selected + 1] += 1;
    seatData.countMap[selected + 2] += 1;
    if (ret === true) {
      debugRecord(selected);
      debugRecord(selected + 1);
      debugRecord(selected + 2);
      return true;
    }
  }
  return false;
}

function checkSingle(seatData1) {
  const seatData = seatData1;
  const { holds } = seatData;
  let selected = -1;
  let c = 0;
  for (let i = 0; i < holds.length; i += 1) {
    const pai = holds[i];
    c = seatData.countMap[pai];
    if (c !== 0) {
      selected = pai;
      break;
    }
  }
  // 如果没有找到剩余牌，则表示匹配成功了
  if (selected === -1) {
    return true;
  }
  // 否则，进行匹配
  if (c === 3) {
    // 直接作为一坎
    seatData.countMap[selected] = 0;
    debugRecord(selected);
    debugRecord(selected);
    debugRecord(selected);
    const ret = checkSingle(seatData);
    // 立即恢复对数据的修改
    seatData.countMap[selected] = c;
    if (ret === true) {
      return true;
    }
  } else if (c === 4) {
    // 直接作为一坎
    seatData.countMap[selected] = 1;
    debugRecord(selected);
    debugRecord(selected);
    debugRecord(selected);
    const ret = checkSingle(seatData);
    // 立即恢复对数据的修改
    seatData.countMap[selected] = c;
    // 如果作为一坎能够把牌匹配完，直接返回TRUE。
    if (ret === true) {
      return true;
    }
  }

  // 按单牌处理
  return matchSingle(seatData, selected);
}

/*
console.log(Date.now());
//检查筒子
checkTingPai(seatData,0,9);
//检查条子
checkTingPai(seatData,9,18);
//检查万字
checkTingPai(seatData,18,27);
console.log(Date.now());

for(k in seatData.tingMap){
	console.log(nameMap[k]);
}
*/

exports.checkTingPai = checkTingPai;
