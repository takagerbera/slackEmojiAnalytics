/**
 * Slack 絵文字解析
 */
function slackEmojiAnalytics() {
  // Slack の API トークン
  let token = '';

  // 絵文字解析インスタンスを定義
  let emojiAnalyzer = new SlackEmojiAnalyze(token);

  // 解析開始日･終了日の定義
  let start = '2021-04-01T00:00:00+09:00';
  let end   = '2022-03-31T23:59:59+09:00';

  // 絵文字解析の実施
  emojiAnalyzer.analyze(start, end);
}

/**
 * Slack絵文字解析クラス
 */
class SlackEmojiAnalyze {

  // コンストラクタ
  constructor(token) {
    // Slack の API トークン有無チェック
    if (token == null)
      throw new Error("API トークンが未定義もしくは null です");

    // スクリプトプロパティ "SLACK_TOKEN" に API トークンを設定
    PropertiesService.getScriptProperties().setProperty('SLACK_TOKEN', token);
  }

  // 解析の実施
  analyze(startDay, endDay) {
    // 対象となるパブリックチャンネル一覧を取得
    let channels = this.getChannels();

    // 対象期間のメッセージデータを取得
    let messages = this.getMessages(channels, startDay, endDay);

    // カスタム絵文字一覧を取得
    let emoji = this.getEmojiData();

    // 期間内で絵文字が使われた頻度をカウント
    let emojiUsage = this.getEmojiCount(messages, emoji);

    // 絵文字が使われた頻度をスプレッドシートへ出力
    this.putSpreadSheet(emoji, emojiUsage);
  }

  // パブリックチャンネル一覧取得
  getChannels() {
    // リクエスト先 URL
    let requestURL = 'https://slack.com/api/conversations.list';

    // API トークン取得
    let token = PropertiesService.getScriptProperties().getProperty('SLACK_TOKEN');

    // 必要パラメータの定義
    let headers = {
      'Authorization' : 'Bearer ' + token,
    };

    let requestOptions = {
        'method'      : 'get',
        'contentType' : 'application/x-www-form-urlencoded',
        'headers'     : headers
    };

    // HTTP GET 用パラメータの定義
    let requestParams = {
      'exclude_archived' : true,
      'type'             : 'public_channel'
    }

    // HTTP GET 用パラメータを文字列化
    let paramStr = Object.entries(requestParams).map(([key, val]) => `${key}=${val}`).join('&');

    // HTTP レスポンス取得
    let response = UrlFetchApp.fetch(requestURL + '?' + paramStr, requestOptions);

    // HTTP レスポンスチェック
    if (response.getResponseCode() != 200)
      throw new Error(response.getContentText());

    // JSON パース
    let json = JSON.parse(response.getContentText());

    // Slack API のレスポンスチェック
    if (!json['ok'])
      throw new Error(json['error']);
    
    // チャンネルの ID をリスト化
    let channelIdList = [];
    for(let channel of json['channels'])
      channelIdList.push(channel['id']);

    // チャンネルの ID 一覧を返却
    return channelIdList;
  }

  // メッセージ一覧取得
  getMessages(channels, start, end) {
    // リクエスト先 URL
    let requestURL = 'https://slack.com/api/conversations.history';

    // メッセージ一覧をまとめたリスト
    let messageList = [];

    // 開始､終了時を UNIX タイムに変換 (帰ってくる数値がミリ秒なので 1000 で割る)
    let oldest = Date.parse(start) / 1000;
    let latest = Date.parse(end) / 1000;

    // API トークン取得
    let token = PropertiesService.getScriptProperties().getProperty('SLACK_TOKEN');

    // UrlFetchApp.fetch 用パラメータの定義
    let headers = {
      'Authorization' : 'Bearer ' + token,
    }

    let requestOptions = {
        'method'      : 'get',
        'contentType' : 'application/x-www-form-urlencoded',
        'headers'     : headers
    };

    // HTTP GET用パラメータの定義
    // limit の数値は API ドキュメントで指定されている最大値 (1000) を指定
    let requestParams = {
      'channel' : '',
      'latest'  : latest,
      'oldest'  : oldest,
      'limit'   : 1000
    }

    for (let channel of channels) {
      // チャンネル名を最新のものに書き換え
      requestParams['channel'] = channel;

      // HTTP GET パラメータを文字列化
      let paramStr = Object.entries(requestParams).map(([key, val]) => `${key}=${val}`).join('&');

      // HTTP レスポンス取得
      let response = UrlFetchApp.fetch(
        requestURL + '?' + paramStr, 
        requestOptions
      );

      // HTTP レスポンスチェック
      if (response.getResponseCode() != 200)
        throw new Error(response.getContentText());

      // JSON パース
      let json = JSON.parse(response.getContentText());

      // Slack API のレスポンスチェック
      if (!json['ok'])
        throw new Error(json['error']);
      
      // メッセージ群をリストに連結
      messageList = messageList.concat(json['messages']);
    }

    // メッセージ一覧を返却
    return messageList;
  }

  // カスタム絵文字一覧を取得
  getEmojiData() {
    // リクエスト先 URL
    let requestURL = 'https://slack.com/api/emoji.list';

    // API トークン取得
    let token = PropertiesService.getScriptProperties().getProperty('SLACK_TOKEN');

    // 必要パラメータの定義
    let headers = {
      'Authorization' : 'Bearer ' + token,
    };

    let requestOptions = {
        'method'      : 'get',
        'contentType' : 'application/x-www-form-urlencoded',
        'headers'     : headers
    };

    // HTTP レスポンス取得
    let response = UrlFetchApp.fetch(requestURL, requestOptions);

    // HTTP レスポンスチェック
    if (response.getResponseCode() != 200)
      throw new Error(response.getContentText());

    // JSON パース
    let json = JSON.parse(response.getContentText());

    // Slack API のレスポンスチェック
    if (!json['ok'])
      throw new Error(json['error']);

    // 絵文字一覧を返却
    return json['emoji'];
  }

  // 絵文字が使われた頻度を取得
  getEmojiCount (messages, emoji) {
    // 絵文字カウンター
    let emojiCounter = {};

    // 絵文字 ID リスト抽出
    let emojiKeys = Object.keys(emoji);

    // 取得したメッセージを走査
    for (let message of messages)
      // リアクションがある場合のみ､中身をみる
      if (message.hasOwnProperty('reactions'))
        for (let reaction of message['reactions']) {
          // 絵文字ID
          let name = reaction['name'];
          
          // カスタム絵文字の場合のみ､カウンターへの追加処理を行う
          if (emojiKeys.includes(name))
            if (emojiCounter[name])
              emojiCounter[name] += reaction['count'];
            else
              emojiCounter[name] = reaction['count'];
        }

    // 絵文字カウンターを返却
    return emojiCounter;
  }

  // スプレッドシートへの出力
  putSpreadSheet(emoji, usage) {
    // アクティブになっているスプレッドシートのインスタンス確保
    let sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('シート1');

    // 一行目を書き込み
    let firstRow = ['ID', '絵文字', '利用回数'];
    sheet.appendRow(firstRow);

    // 絵文字ごとに利用状況をセルに書き出し
    for (let key in emoji) {
      // 絵文字の利用回数取得
      let emojiCount = 0;
      if (usage[key])
        emojiCount = usage[key];

      // 新規行の追加
      let newRow = [key, '=image("' + emoji[key] + '")', emojiCount];
      sheet.appendRow(newRow);
    }
  }
}
