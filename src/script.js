/////////////////////////////////////////////////////////////////////////
///// IMPORT
import './style.css'
// Textalive関連
import Songs from './song.json'; //プロコン用の楽曲データ　★FFT用のjsonを読み込むようにParamを追加しています！
import { Player } from "textalive-app-api";
// Three.js関連
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import Stats from "three/examples/jsm/libs/stats.module";
import GUI, { FunctionController } from 'lil-gui';
import { FontLoader } from 'three/addons/loaders/FontLoader.js';
import Typeface from '../static/ZenOldMincho_Regular_min.json';

let FFTJson;

// GUIの初期設定
const gui = new GUI({width:180});
gui.domElement.id = 'gui';
gui.close();

// Three.js でテキストを生成するために必要なフォントデータを読み込む
const fontLoader = new FontLoader();
const Ffont  = fontLoader.parse(Typeface);


window.onload = function(){

/////////////////////////////////////////////////////////////////////////
///// 
///// TextAlive-Api
///// 
///// 
/////////////////////////////////////////////////////////////////////////

//TextAlive_APi初期化
const player = new Player({
    // Interface PlayerOptions
    // https://developer.textalive.jp/packages/textalive-app-api/interfaces/PlayerOptions.html
    //
    app: { 
      token: "★★★★★",//Token　★★★★★取得したトークンを追加ください！！！★★★★
      parameters: [
      ]
    },
    mediaElement: document.querySelector("#media"),
    vocalAmplitudeEnabled : true,/*歌声の声量*/
    valenceArousalEnabled : true,/*感情値*/

    //fontFamilies: ["kokoro"], // null <= すべてのフォントを読み込む
    //lyricsFetchTimeout:1000, //
    //throttleInterval:10, //アップデート関数の発行間隔をしていする。ミリセカンド。
    //mediaBannerPosition:"top", //音源メディアの情報を表示する位置を指定する。座標指定ではない。
});

//★デバック時のみ[0~100]
player.volume = 10;

/////////////////////////////////////////

//テキストのグローバル変数
let nowChar = "";
let nowWord = "";
let nowPhrase = "";
//曲の長さ&終了処理をする
let endTime = 0;
let voiceEndTime = 0;
//最大声量
let MaxVocal = 0;
let SongVocal = 0; //0~1の値

//場面構成
let SEGMENTS=[];
let nowSegment = 0;//曲のいまのセグメントを管理するグローバル変数

// リスナの登録 / Register listeners
player.addListener({

    onAppReady: (app) => {
      if (!app.managed) {
        player.createFromSongUrl( Songs[0].url, Songs[0].data);

        //
        // ★FFT・WAVE データの読み込み
        // Song.jsonに読み込むためのファイルのParamを記載する
        //

        fetch( Songs[0].json)
        .then(response => response.json())
        .then(data => {
          // JSONデータがdata変数に格納されます
          FFTJson = data;
        })
        .catch(error => {
          console.error('Error fetching data:', error);
        });

        // 
        // 生きること / nogumi feat. 初音ミク
        // player.createFromSongUrl("https://piapro.jp/t/fnhJ/20230131212038", {
        //    video: {
        //     // 音楽地図訂正履歴: https://songle.jp/songs/2245018/history
        //     beatId: 4267300,
        //     chordId: 2405033,
        //     repetitiveSegmentId: 2475606,
        //     // 歌詞タイミング訂正履歴: https://textalive.jp/lyrics/piapro.jp%2Ft%2FQtjE%2F20220207164031
        //     lyricId: 56131,
        //     lyricDiffId: 9638
        //    },
        // });
        //
  
      } else {
        console.log("No app.managed"); 
      }

      if (!app.managed) {
      }
    },

    onAppMediaChange: (mediaUrl) => {
      console.log("新しい再生楽曲が指定されました:", mediaUrl);
    },

    onVolumeUpdate: (e)=>{
      console.log("Volume", e);
    },
  
    onFontsLoad: (e) =>{/* フォントが読み込めたら呼ばれる */
      console.log("font", e);
    },
  
    onTextLoad: (body) => {/* 楽曲のテキスト情報が取得されたら */
      console.log("onTextLoad",body);
    },
  
    onVideoReady: (video)=> {/* 楽曲情報が取れたら呼ばれる */

      if (!player.app.managed) {
        //document.querySelector("#message").className = "active";

        const elements = document.querySelectorAll('.segment-bar'); // 指定したクラスの要素を取得
        elements.forEach(element => element.remove()); // 要素を削除

        //ビート・コード進行・繰り返し区間（サビ候補）・ビート、コード進行、繰り返し区間のリビジョンID（バージョン番号）
        //セグメント_繰り返し区間（サビ候補）
        let Segments = player.data.songMap.segments;
        let NosortSegments =[];
        for(let i=0; i<Segments.length; i++){
          if(Segments[i].chorus){
              Array.from(Segments[i].segments, (z)=>{
                z.chorus = true;
                z.section = i;
                NosortSegments.push(z);
              })
          }else{
              Array.from(Segments[i].segments, (z)=>{
                z.chorus = false;
                z.section = i;
                NosortSegments.push(z);
              })
          }
        }
        //時間に降順にして配列情報を渡す オブジェクトの昇順ソート
        SEGMENTS = NosortSegments.sort(function(a, b) {return (a.startTime < b.startTime) ? -1 : 1;});
        console.log("サビの区間情報：",SEGMENTS);
        MaxVocal = player.getMaxVocalAmplitude();
        console.log("最大声量：" + MaxVocal)
        //終了処理のために取得するグローバル変数
        voiceEndTime = player.video.data.endTime;
        endTime = player.video.data.duration;
        console.log("終了時間 VoiceEndTime:" + voiceEndTime);
        console.log("終了時間 duration:" + endTime);
        console.log("FPS:" + player.fps);

      }//END if (!player.app.managed)
  
    },
  
    onTimerReady() {/* 再生コントロールができるようになったら呼ばれる */
      //loadingのテキストの書き換え
      console.log("再生準備ができました");
      
      //再生ボタンのスイッチング
      document.getElementById("Play-Btn").addEventListener("click", () => function(p){  
        if (p.isPlaying){ 
            //再生中
        }else{
            //再生してない
            p.requestPlay();
        }
      }(player));

      //停止ボタンのスイッチング
      document.getElementById("Stop-Btn").addEventListener("click", () => function(p){ 
        if (p.isPlaying){
          //再生中なら
            p.requestStop();
        }else{ 
          //再生してない   
        }
      }(player));

    },
  
    onPlay: () => {/* 再生時に呼ばれる */
      console.log("player.onPlay");
    },
  
    onPause: () => {
      console.log("player.onPause");
      //★初期起動時にpostion値が入るバグ回避
      player.requestStop();//onStopを呼ぶ 
    },
  
    onSeek: () => {
      console.log("player.onSeek");
    },
  
    onStop: () => {
      console.log("player.onStop");
      
      //初期化
      nowChar = "";
      nowWord = "";
      nowPhrase = "";
    },
  
    //再生時に回転する 再生位置の情報が更新されたら呼ばれる */
    // onTimeUpdate: (position) =>{
    //   console.log(position);

    //   /* 歌詞＆フレーズ　*/
    //   let Char = player.video.findChar(position - 100, { loose: true });
    //   let Word = player.video.findWord( position - 100, { loose: true });
    //   let Phrase = player.video.findPhrase( position - 100, { loose: true });
      
    //   //文字を取得する
    //   if(nowChar != Char.text){
    //         nowChar = Char.text;
    //         console.log(nowChar);
    //   }//End if(char)

    //   //単語を取得する
    //   if(Word){
    //     if(nowWord != Word.text){
    //         nowWord = Word.text;
    //         console.log(nowWord);
    //     }
    //   }//End if(Word)
      
    //   //フレーズを取得する
    //   if(Phrase) {
    //     if(nowPhrase != Phrase.text){
    //         nowPhrase = Phrase.text
    //         console.log(nowPhrase);
    //     }
    //   }//End if(phrase)
      
    //   //ボーカルの声量を取得する
    //   SongVocal = player.getVocalAmplitude(position)/ MaxVocal;
    //   console.log(SongVocal);

    //   //声量を100%で表示する
    //   //positionbarElement.style.width = Math.floor( position ) / endTime * 100 + "%";
    // }// End onTimeUpdate
  

});//END player.addListener
  

//
// 曲を別のものに変更されたら起動する
//

function valueChange(){
  // イベントが発生した時の処理
  let num = document.getElementById("select").value;
  player.createFromSongUrl( Songs[num].url, Songs[num].data,);
  //
  console.log("Select_Change");

  // FFT・WAVE データの読み込み
  fetch( Songs[num].json)
  .then(response => response.json())
  .then(data => {
    // JSONデータがdata変数に格納されます
    FFTJson = data;
  })
  .catch(error => {
    console.error('Error fetching data:', error);
  });

}

// 選択式のメニューで変更があったら、新しい曲に変更される
let element = document.getElementById('select');
element.addEventListener('change', valueChange);


/////////////////////////////////////////////////////////////////////////
///// 
///// THREE.JS
///// 
///// 
/////////////////////////////////////////////////////////////////////////

/////////////////////////////////////////////////////////////////////////
///// SCENE CREATION

const scene = new THREE.Scene()
scene.background = new THREE.Color('#000');

/////////////////////////////////////////////////////////////////////////
///// RENDERER CONFIG

let PixelRation = 1; //PixelRatio
PixelRation = Math.min(window.devicePixelRatio, 2.0);

const renderer = new THREE.WebGLRenderer({
  canvas:document.getElementById("MyCanvas"),
  alpha:true,
  antialias: true,
});
renderer.setPixelRatio(PixelRation) //Set PixelRatio
renderer.setSize(window.innerWidth, window.innerHeight) // Make it FullScreen

/////////////////////////////////////////////////////////////////////////
// STATS SET

const stats = new Stats();
stats
stats.showPanel(0); // 0: fps, 1: ms, 2: mb, 3+: custom
document.body.appendChild(stats.dom);
Object.assign(stats.dom.style, {'position': 'fixed','height': 'max-content',
  'left': '0','right': 'auto',
  'top': 'auto','bottom': '0'
});

/////////////////////////////////////////////////////////////////////////
///// CAMERAS CONFIG

const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 1, 1000)
camera.position.set(0.0, 0.0, 120.0);
scene.add(camera)

/////////////////////////////////////////////////////////////////////////
///// CREATE ORBIT CONTROLS

const controls = new OrbitControls(camera, renderer.domElement)

/////////////////////////////////////////////////////////////////////////
///// CREATE HELPER

const size = 200;
const divisions = 40;

const gridHelperA = new THREE.GridHelper( size, divisions, "#333333", "#333333" );
gridHelperA.position.set(0.0, 0.0, 0);
gridHelperA.rotation.x = Math.PI/2
gridHelperA.visible = true;
scene.add( gridHelperA );

const axesHelper = new THREE.AxesHelper(5);
axesHelper.visible = true;
scene.add(axesHelper);

/////////////////////////////////////////////////////////////////////////
///// OBJECT DELETE

// Sceneにある指定されたidを削除する
function removeObjectsByName(SC, Name) {
  const objects = [];
  
  SC.traverse((object) => {
    if (object.name === Name) {
      objects.push(object);
    }
  });

  objects.forEach((object) => {

    SC.remove(object);
    //
    if(object.type == 'Group'){
      object.children.forEach((element) => {
        element.geometry.dispose();

        element.material.dispose();
      });
    }else{
      object.geometry.dispose();

      object.material.dispose();
    }
  });

}// End removeObjectsByName()

/////////////////////////////////////////////////////////////////////////
///// OBJECT SET

class ObjectText{
  // コンストラクター
  constructor(string, PhraseData) {
    this.string = string;
    this.Data = PhraseData;

    this.material = new THREE.MeshBasicMaterial({
      color: 0xeeeeee,
      side: THREE.DoubleSide,
      transparent: true,
      wireframe: false,
    });
  }

  //メソッド　Fillテキスト
  CreatObject(){
    const TEXT = this.string;
    const shapes = Ffont.generateShapes( TEXT, 4 );//文字サイズ
    const TextGeometry = new THREE.ShapeGeometry( shapes, 4 );
    TextGeometry.computeBoundingBox();
    TextGeometry.center();//Center the geometry based on the bounding box.

    const Geotext = new THREE.Mesh( TextGeometry, this.material );

    Geotext.position.y = 15;
    Geotext.name = "SongText";
    scene.add(Geotext);
  }

}

////////////////////////////////////////////////////////////
///// FFT OBJECT SET

const boxGroup = new THREE.Group();

const boxgeometry = new THREE.BoxGeometry( 0.4, 0.4, 0.4 );
boxgeometry.translate(0,0.2,0);
const material = new THREE.MeshBasicMaterial({
  color: 0x6699FF,
  transparent: true, 
});

for (let i = 0; i < 64; i ++) {
  const boxmesh = new THREE.Mesh( boxgeometry, material );
  boxmesh.position.set(
    i * 2,
    0,
    0
  )
  
  boxGroup.add( boxmesh );
}
boxGroup.position.set(-64, -15, 0);
scene.add(boxGroup);


////////////////////////////////////////////////////////////
///// Wave OBJECT SET

const boxGroupB = new THREE.Group();
const boxGroupC = new THREE.Group();

const boxgeometryB = new THREE.BoxGeometry( 0.2, 0.5, 0.2 );
const materialB = new THREE.MeshBasicMaterial({
    color: 0xee0000,
    transparent: true, 
});

for (let i = 0; i < 64; i ++) {  
  const boxmesh = new THREE.Mesh( boxgeometryB, materialB );
  boxmesh.position.set(
    i * 2,
    0,
    0,
  )

  boxGroupC.add( boxmesh );
}

boxGroupB.add( boxGroupC );
boxGroupB.position.set(-64, -30, 0);

scene.add(boxGroupB);

////////////////////////////////////////////////////////////
///// SEARCH JSON ParamData

function findClosestNumber(Position) {
  // 最初の要素を初期値として設定
  let closest = FFTJson[0].t;
  let minDifference = Math.abs(closest - Position);
  let Result = FFTJson[0];

  let beforediffere = Math.abs(closest - Position);

  // 配列内の各要素を検査して最も近い数値を見つける
  for (let i = 1; i < FFTJson.length; i++) {
      const difference = Math.abs(FFTJson[i].t - Position);
      if (difference < minDifference) {
          minDifference = difference;
          beforediffere = difference;
          Result = FFTJson[i];
      }
      if( beforediffere < difference){
        break;
      }
  }

  return Result;
}

/////////////////////////////////////////////////////////////////////////
//// RENDER LOOP FUNCTION

const clock = new THREE.Clock();

const positionbarElement = document.getElementById("nav-bar");
const beatElement = document.getElementById("gpu-Beat-bar");

let FFTArrat = [];

function renderLoop() {
    stats.begin();//STATS計測
    //const delta = clock.getDelta();//animation programs
    //const elapsedTime = clock.getElapsedTime();

    ////////////////////////////////////////
    // TextAlive 
    if(player.isPlaying){
      const position = player.timer.position;

      /////////////////////////////////////////////////////////////
      // ★ FFT&Wave

      const FFTArray = findClosestNumber(position); 

      if(FFTArray.length != 0){

        if(FFTArrat["t"] != FFTArray["t"]){

          FFTArrat = FFTArray
          
          // FFT update
          FFTArray["F"].forEach(function(element, index){
            boxGroup.children[index].scale.set(1, 0.01 + element*40, 1);
          });
          
          // Wave update
          FFTArray["W"].forEach(function(element, index){
            boxGroupB.children[0].children[index].scale.set(1, 0.01 + (element-0.5)*100, 1);
          });

        }
      }

      /////////////////////////////////////////////////////////////

      //ビートの計算
      const SongBeat = player.findBeat(position);
      if(SongBeat){
        beatElement.style.width = SongBeat.progress(position) * 100 + "%";
      }

      // テキスト表示
      //let Char = player.video.findChar(position - 100, { loose: true });
      //let Word = player.video.findWord( position - 100, { loose: true });
      let Phrase = player.video.findPhrase( position - 100, { loose: true });
      
      if(Phrase) {
        if(nowPhrase != Phrase.text){
          //
          nowPhrase = Phrase.text
          //
          const StartTime = Phrase.startTime - position - 100;
          const EndTime = Phrase.endTime - position;
          
          // テキストの生成
          setTimeout(() => {
            const text = new ObjectText(nowPhrase,Phrase);
            text.CreatObject();
          }, StartTime);

          // テキストの削除
          setTimeout(() => {
            removeObjectsByName(scene, "SongText");
          },EndTime);

        }
      }//End if(phrase)

      //再生バーの更新
      positionbarElement.style.width = Math.floor( position ) / endTime * 100 + "%"; 

    }
    // End TextAlive
    ////////////////////////////////////////

    renderer.render(scene, camera) // render the scene using the camera

    requestAnimationFrame(renderLoop) //loop the render function
    stats.end();//stats計測
}

renderLoop() //start rendering


/////////////////////////////////////////////////////////////////////////
///// MAKE EXPERIENCE FULL SCREEN

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight
    camera.updateProjectionMatrix()
    //
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2.0)) //set pixel ratio
    renderer.setSize(window.innerWidth, window.innerHeight) // make it full screen  
})

/////////////////////////////////////////////////////////////////////////
///// STATS SETTING

const params = {						  
  myVisibleBoolean1: true,
  myVisibleBoolean2: false,
  valueA: 0.0, //
  valueB: 0.0, //
};
	
gui.add( params, 'myVisibleBoolean1').name('helper').listen()
.listen().onChange( function( value ) { 
  if( value == true ){
    gridHelperA.visible = value;
    axesHelper.visible = value;
  }else{
    gridHelperA.visible = value;
    axesHelper.visible = value;
  }
});


}//End Windows.onload
