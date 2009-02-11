#!/bin/sh

# build dojo.js and qd.js
pushd src/js/dev/util/buildscripts
./build.sh action=clean,release dojodir=../.. profileFile=../../qd/qd.profile.js releaseName=queued releaseDir=../../release version=1.2.3.qd optimize=none layerOptimize=none copyTests=false
popd
/bin/cp src/js/dev/release/queued/dojo/dojo.js src/js
/bin/cp src/js/dev/release/queued/dojo/qd.js src/js
/bin/rm -Rf src/js/dev/release

# build the .air package
files='
Queued
Queued.html 
Mini.html
updateConfig.xml
img 
css
lib
js/dojo.js
js/qd.js
js/dojo
js/dijit
js/dojox
js/nls
js/_firebug
js/updates
js/dev/dair
js/dev/qd
'
adt -package -storetype pkcs12 -keystore YOUR_CERTIFICATE_HERE.p12 Queued.air src/Queued.xml -C $files 
