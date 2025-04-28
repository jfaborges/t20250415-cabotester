const fs = require("fs");
const { resolve } = require("path");

const CUTPATTERN = /(.*)♦️♦️/g;
const CUTSTRING = "##CUT##\r\n";
const UTCOFFSETSTRING = "-03:00";
const DATEPATTERN = /\[(\d{2}):(\d{2}), (\d{2})\/(\d{2})\/(\d{4})\]/g;
const UPDATEMSGPATTERN = /e20\d{6}T\d{4} {1,}t\d{1}-m\d{1}-\d{1,}/gi;
const COMMITPATTERN1 = /Mula:/gi;
const COMMITPATTERN2 = /Teste:/gi;
const COMMITPATTERN3 = /Cabo:/gi;
const EVALPATTERN1 = /Capa/gi;
const EVALPATTERN2 = /Veia/gi;
const EVALPATTERN3 = /Luva/gi;
const SINGLETESTPATTERN0 = /(e20\d{6}T\d{4})/gi;
const SINGLETESTPATTERN1 =
  /(e20\d{6}T\d{4}) {1,}(t\d{1})-(m\d{1}-\d{1,}) {1,}\((.*)\) {1,}(\d*)c/gi;
const SINGLETESTPATTERN2 =
  /(e20\d{6}T\d{4}) {1,}(t\d{1})-(m.-.) {1,}\((.*)\)/gi;

class SnippetType {
  static Undefined = new SnippetType("Undefined");
  static NoInfo = new SnippetType("NoInfo");
  static Update = new SnippetType("Update");
  static Eval = new SnippetType("Eval");
  static ComissionMsg = new SnippetType("ComissionMsg");

  constructor(name) {
    this.name = name;
  }
}

const readFile = async (filename) => {
  console.log('Reading file: "' + filename + '"');
  try {
    const data = await fs.readFileSync(filename, "utf-8");
    return data;
  } catch (err) {
    console.log(err);
  }
};

const separateParseItems = (data) => {
  data = data.replace(CUTPATTERN, CUTSTRING + "$1");
  data = data.split(CUTSTRING);

  return data;
};

const findDateAtParsedItem = async (parsedItemData) => {
  return new Promise((resolve, reject) => {
    const dataLineByLine = parsedItemData.split("\n");
    let resp = {};
    resp.StartDate = null;
    resp.EndDate = null;
    resp.hasDate = false;

    dataLineByLine.forEach((line) => {
      const hasDate = line.match(DATEPATTERN);

      if (hasDate) {
        const ParsedDateStr = hasDate[0].replace(
          DATEPATTERN,
          "$5-$4-$3T$1:$2:00.000" + UTCOFFSETSTRING
        );

        if (!resp.hasDate) {
          resp.StartDate = new Date(ParsedDateStr);
          resp.EndDate = new Date(ParsedDateStr);
          resp.hasDate = true;
        } else {
          resp.EndDate = new Date(ParsedDateStr);
        }
      }
    });
    resolve(resp);
  });
};

const checkNoInfo = (parsedItemData) => {
  const lines = parsedItemData.trim().split("\n");

  if (lines.length <= 1) {
    return true;
  }
  return false;
};

const checkUpdateMsg = (parsedItemData) => {
  return new Promise((resolve, reject) => {
    const lines = parsedItemData.trim().split("\n");

    lines.forEach((line) => {
      const hasTest = line.match(UPDATEMSGPATTERN);

      if (hasTest) {
        resolve(true);
      }
    });

    resolve(false);
  });
};

const checkComissionMsg = (parsedItemData) => {
  return new Promise((resolve, reject) => {
    const lines = parsedItemData.trim().split("\n");

    let pattern1 = false;
    let pattern2 = false;
    let pattern3 = false;

    lines.forEach((line) => {
      if (line.match(COMMITPATTERN1)) {
        pattern1 = true;
      }
      if (line.match(COMMITPATTERN2)) {
        pattern2 = true;
      }
      if (line.match(COMMITPATTERN3)) {
        pattern3 = true;
      }
    });

    if (pattern1 && pattern2 && pattern3) {
      resolve(true);
    }

    resolve(false);
  });
};

const checkEvalMsg = (parsedItemData) => {
  return new Promise((resolve, reject) => {
    const lines = parsedItemData.trim().split("\n");

    let pattern1 = false;
    let pattern2 = false;
    let pattern3 = false;

    lines.forEach((line) => {
      if (line.match(EVALPATTERN1)) {
        pattern1 = true;
      }
      if (line.match(EVALPATTERN2)) {
        pattern2 = true;
      }
      if (line.match(EVALPATTERN3)) {
        pattern3 = true;
      }
    });

    if (pattern1 && pattern2 && pattern3) {
      resolve(true);
    }

    resolve(false);
  });
};

const getParsedItemType = async (parsedItemData) => {
  let type = SnippetType.Undefined;
  try {
    type = checkNoInfo(parsedItemData)
      ? SnippetType.NoInfo
      : SnippetType.Undefined;

    type = (await checkUpdateMsg(parsedItemData)) ? SnippetType.Update : type;

    type = (await checkComissionMsg(parsedItemData))
      ? SnippetType.ComissionMsg
      : type;

    type = (await checkEvalMsg(parsedItemData)) ? SnippetType.Eval : type;
  } catch (err) {
    console.log(err);
  }

  return type;
};

const parseFile = async (filename) => {
  var parsedData = [];
  var data = "";
  try {
    data = await readFile(filename);

    data = separateParseItems(data);

    parsedData = data.map(async (e, n) => {
      var parsedItem = {};
      parsedItem.id = n;
      parsedItem.data = e;

      let date = await findDateAtParsedItem(e);
      parsedItem.startDate = date.StartDate;
      parsedItem.endDate = date.EndDate;
      parsedItem.hasDate = date.hasDate;

      parsedItem.type = await getParsedItemType(e);

      return parsedItem;
    });

    parsedData = await Promise.all(parsedData);
  } catch (err) {
    console.log(err);
  }

  return parsedData;
};

const parseUpdateIndividualItem = async (dataItem) => {
  return new Promise((resolve, reject) => {
    const lines = dataItem.trim().split("\n");

    var updates = lines.map((line, n) => {
      if (line.match(SINGLETESTPATTERN2)) {
        var updatesItem = {};
        var read;

        read = line.match(/e20\d{6}T\d{4}/g);
        read ? (updatesItem.test = read[0]) : (updatesItem.test = "");

        read = line.match(/ {1,}(t\d{1})/g);
        read
          ? (updatesItem.test_tomada = read[0].trim())
          : (updatesItem.test_tomada = "");

        read = line.match(/m.-./);
        read ? (updatesItem.maq_pos = read[0]) : (updatesItem.maq_pos = "");

        read = line.match(/\((.*)\)/);
        read ? (updatesItem.status = read[1]) : (updatesItem.status = "");

        read = line.match(/ (\d*)c/);
        read
          ? (updatesItem.ciclos = parseInt(read[1]))
          : (updatesItem.ciclos = "");

        return updatesItem;
      }
    });

    //remove the undefineds
    updates = updates.filter((line, n) => line !== undefined);

    //resolves the promisse
    resolve(updates);
  });
};

const parseComissionMsgItem = async (dataItem) => {
  return new Promise((resolve, reject) => {
    console.log("💡💡💡 COMMIT MSG 💡💡💡💡");
    var returnData = {};
    var data;

    //separa a mensagem de comissionamento em blocos pelo caractere diamante
    var blocks = dataItem.trim().split("♦️");

    //remove os blocos em branco (desnecessários)
    blocks = blocks.filter((e) => e.length != 0);

    //parse do primeiro bloco (obrigatório)
    console.log(blocks[0]);
    var lines = blocks[0].trim().split("\n"); //separação do bloco 0 em linhas

    //primeira linha do bloco, código e
    data = lines[0].match(/e\d{8}T\d{4}/);
    data ? (returnData.testId = data[0]) : (returnData.testId = "");

    //segunda linha do bloco (mula)
    data = lines[1].match(/^.ula: (.*)/);
    console.log(data);

    console.log(returnData);
  });
};

const parseSnippets = async (parsedData) => {
  parsedData = parsedData.map(async (e, n) => {
    if (e.type === SnippetType.Update) {
      e.snippetDetails = await parseUpdateIndividualItem(e.data);
      return e;
    }
    if (e.type === SnippetType.Eval) {
      e.snippetDetails = [];
      return e;
    }
    if (e.type === SnippetType.ComissionMsg) {
      e.snippetDetails = await parseComissionMsgItem(e.data);
      return e;
    }
    e.snippetDetails = [];
    return e;
  });

  parsedData = await Promise.all(parsedData);

  // parsedData.forEach((e) => {
  //   console.log(e.snippetDetails);
  // });
};

(async () => {
  try {
    var parsedData = [];
    parsedData = await parseFile("snippet1.txt");
    parsedData = await parseSnippets(parsedData);
  } catch (err) {
    console.log(err);
  }
})();
