# 任意のフィードをmBaaS（[ニフティクラウド mobile backend](http://mb.cloud.nifty.com)）に登録するデモコードです。

## 使い方

インストールはnode.jsが必須です。

```
npm install
```

実際に使う時にはフィードのURLを渡すだけです。

```
$ node index.js http://feeds.feedburner.com/moongift
```

## 結果

- Feedクラスにフィードのメイン情報が登録されます
- Itemクラスにフィードごとの記事情報が登録されます

## 注意点

現在はAtomフォーマットにのみ対応しています。

## ライセンス

MIT License

