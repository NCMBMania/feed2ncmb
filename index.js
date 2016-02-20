var request = require('request');
sha256 = require('js-sha256');

var NCMB = require('ncmb');
var application_key = 'YOUR_APPLICATION_KEY';
var client_key = 'YOUR_CLIENT_KEY';
var ncmb = new NCMB(application_key, client_key);
var Feed = ncmb.DataStore("Feed");
var Item = ncmb.DataStore("Item");

var argv = require('argv');
var url = argv.run().targets[0];

// XMLをJSONに変換します
// Atom2.0に対応しています
function xml2json(body) {
   json = JSON.parse(require('xml2json').toJson(body));
   if (json.feed && json.feed.entry) {
     // Atom feedの場合はここです
     // メイン情報の設定
     var obj = {
       title: json.feed.title,
       subtitle: json.feed.subtitle,
       url: json.feed.link.href,
       items: []
     };
     
     // 記事情報の設定
     for (var i in json.feed.entry) {
       item = json.feed.entry[i];
       new_item = {
         id: sha256(item.id),
         created: item.published,
         updated: item.updated,
         url: item.link.href,
         title: item.title,
         content: item.content['$t'],
         category: [],
         author: item.author.name
       };
       
       // カテゴリが単数の場合と複数とで処理分け
       if (item.category.term) {
         new_item.category.push(item.category.term);
       }else{
         for (var j in item.category) {
           var c = item.category[j];
           new_item.category.push(c.term || c);
         }
       }
       
       // 返却するデータに追加
       obj.items.push(new_item);
     }
     return obj;
   }
}

/*
  * フィードをmBaaSから探して、あればFeedオブジェクトを、
  * なければ新しく作ってFeedオブジェクトを返します
*/
function find_or_create_feed(json) {
  // 非同期処理なのでPromiseで囲みます
  var p = new Promise(function(resolve, reject) {
    // フィードをURLで検索します
    Feed.equalTo("url", json.url)
      .fetch()
      .then(function(feed) {
        // データがある場合はFeedオブジェクトを返します
        if (Object.keys(feed).length > 0) {
          return resolve(feed);
        }
        
        // なければ新しく作ります
        var new_feed = new Feed();
        new_feed
          .set("title", json.title)
          .set("subtitle", json.subtitle)
          .set("url", json.url)
          .save()
          .then(function(ncmb_feed) {
            // 保存結果がうまくいった場合は
            // Feedオブジェクトを返します
            return resolve(ncmb_feed);
          }).catch(function(err) {
            // エラーがあった場合はPromise
            // の失敗として返します
            return reject(err);
          });
      })
      .catch(function(err) {
        // 検索が失敗したらPromiseのエラーとして
        // 返します
        return reject(err);
      })
  });
  return p;
}


/*
  * フィードに記事を登録します
  * Promiseを使ったループ処理になっています
*/
function items_register(feed, items) {
  // 処理全体のPromiseです
  var p = new Promise(function(res, rej) {
    // 個別の記事を登録する処理です
    function item_register(feed, item, item_id) {
      // 記事がない場合は全記事処理し終わったと見なしてPromiseのresolveを実行します
      if (typeof item === 'undefined') {
        return res("");
      }
      
      // 非同期処理なのでPromiseで囲みます
      return new Promise(function(resolve, reject) {
        // 記事を探します
        // フィードの中で、かつIDが一致するものを検索します
        Item.equalTo("feed", {"__type": "Pointer", "className": "Feed", "objectId": feed.objectId})
          .equalTo("id", item.id)
          .fetch()
          .then(function(ncmb_item) {
            
            // すでに登録されている場合は次の記事を処理します
            if (Object.keys(ncmb_item).length > 0) {
              return item_register(feed, items[item_id], item_id+1);
            }
            
            // データがない場合は新しい記事オブジェクトを作成します
            new_item = new Item();
            
            // フィードをポインターとして保存します
            new_item.set("feed", feed);
            
            // データを順番に登録していきます
            for (var j in item) {
              new_item.set(j, item[j]);
            }
            
            // 保存処理を実行します
            new_item.save()
              .then(function(item){
                // 保存処理がうまくいった場合は次の記事を処理する
                return item_register(feed, items[item_id], item_id+1);
              })
              .catch(function(err) {
                // エラーがあった場合は全体のPromiseにおいてエラーにします
                return rej(err);
              });
          })
          .catch(function(err) {
            // データが取れないなどのエラーがあった場合はPromise全体のエラーにします
            return rej(err);
          });
      });
    }
    // 最初の処理を実行します
    item_register(feed, items[0], 0);
  });
  return p;
}

// 全体の処理
request(url, function (error, response, body) {
  if (!error && response.statusCode == 200) {
    var json = xml2json(body);
    
    // フィードクラスを探します
    // なければ作成します
    find_or_create_feed(json)
      .then(function(feed) {
        // 処理がうまくいったら
        // Feedオブジェクトがくるので、記事の登録をします
        items_register(feed, json.items)
          .then(function() {
            console.log("Registered.")
          })
      })
  }
});
 