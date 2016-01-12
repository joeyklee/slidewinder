// Generated by CoffeeScript 1.10.0
(function() {
  var CollectionManager, PresentationFramework, SlideCollection, SlideDeck, _, et, fm, fs, handlebars, log, log_colours, logger, mkdirp, path, yaml,
    bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; };

  fs = require('fs-extra');

  et = require('expand-tilde');

  path = require('path');

  fm = require('front-matter');

  handlebars = require('handlebars');

  _ = require('lodash');

  mkdirp = require('mkdirp');

  logger = require('./log.js');

  yaml = require('js-yaml');

  log_colours = {
    silly: 'magenta',
    input: 'grey',
    verbose: 'cyan',
    prompt: 'grey',
    debug: 'blue',
    info: 'green',
    data: 'grey',
    help: 'cyan',
    warn: 'yellow',
    error: 'red'
  };

  SlideCollection = (function() {
    function SlideCollection(folder, name1) {
      this.name = name1;
      this.parseSlides = bind(this.parseSlides, this);
      this.folder = path.normalize(et(folder));
      this.slides = {};
      this;
    }

    SlideCollection.prototype.parseSlides = function() {
      this.slides = {};
      fs.readdirSync(this.folder).forEach((function(_this) {
        return function(file) {
          var data, filepath, name, slide;
          if (file.substr(-3) === '.md') {
            filepath = path.resolve(_this.folder, file);
            data = fs.readFileSync(filepath, 'utf8');
            slide = fm(data);
            name = slide.attributes.name;
            if (_this.slides[name]) {
              return log.error('Multiple slides have the name', name, 'in one collection!');
            } else {
              return _this.slides[name] = slide;
            }
          }
        };
      })(this));
      return log.info('Loaded', this.nSlides(), 'markdown slide files from', this.folder);
    };

    SlideCollection.prototype.slideNames = function() {
      return Object.keys(this.slides);
    };

    SlideCollection.prototype.nSlides = function() {
      return this.slideNames().length;
    };

    SlideCollection.prototype.selectSlide = function(name) {
      if (this.slides[name] == null) {
        log.error('No slide exists in collection', this.name, 'with a name of', name);
        process.exit();
      }
      return this.slides[name];
    };

    SlideCollection.prototype.writeSync = function(dir) {
      return this.slideNames().forEach((function(_this) {
        return function(key) {
          var completeBody, slide;
          slide = _this.slides[key];
          completeBody = "---\n" + (yaml.dump(slide.attributes)) + "---\n" + slide.body;
          return fs.outputFileSync(path.join(et(dir), key + ".md"), completeBody);
        };
      })(this));
    };

    return SlideCollection;

  })();

  CollectionManager = (function() {
    function CollectionManager(colpaths) {
      this.collections = {};
      Object.keys(colpaths).forEach((function(_this) {
        return function(key) {
          return _this.addCollection(key, colpaths[key]);
        };
      })(this));
      this;
    }

    CollectionManager.prototype.collectionNames = function() {
      return Object.keys(this.collections);
    };

    CollectionManager.prototype.addCollection = function(name, path) {
      return this.collections[name] = new SlideCollection(path, name);
    };

    CollectionManager.prototype.parseCollections = function() {
      return this.collectionNames().forEach((function(_this) {
        return function(key) {
          return _this.collections[key].parseSlides();
        };
      })(this));
    };

    CollectionManager.prototype.selectSlide = function(collection, slide) {
      if (this.collections[collection] == null) {
        log.error('No collection is loaded with a name of', collection);
        process.exit();
      }
      return this.collections[collection].selectSlide(slide);
    };

    CollectionManager.prototype.writeAllSync = function(dir) {
      return this.collectionNames().forEach((function(_this) {
        return function(key) {
          var fullpath;
          fullpath = path.join(dir, key);
          return _this.collections[key].writeSync(fullpath);
        };
      })(this));
    };

    return CollectionManager;

  })();

  SlideDeck = (function() {
    function SlideDeck(title, author, collections1) {
      this.collections = collections1;
      this.globals = {
        title: title,
        author: author
      };
      this.rawSlides = [];
      this.processedSlides = void 0;
      this.renderedDeck = void 0;
    }

    SlideDeck.prototype.slideNames = function() {
      var names;
      names = [];
      this.rawSlides.forEach(function(slide) {
        return names.push(slide.attributes.name);
      });
      return names;
    };

    SlideDeck.prototype.assemble = function(selections) {
      return selections.forEach((function(_this) {
        return function(selection) {
          var group, slide;
          group = selection[0];
          slide = selection[1];
          return _this.rawSlides.push(_this.collections.selectSlide(group, slide));
        };
      })(this));
    };

    SlideDeck.prototype.preProcessSlides = function(framework) {
      this.processedSlides = JSON.parse(JSON.stringify(this.rawSlides));
      return this.processedSlides.forEach((function(_this) {
        return function(slide) {
          return framework.slideProcessors.forEach(function(op) {
            return op(slide, _this.globals);
          });
        };
      })(this));
    };

    SlideDeck.prototype.render = function(framework) {
      var renderContext;
      renderContext = {
        deck: {
          title: this.globals.title,
          author: this.globals.author
        },
        slides: this.processedSlides
      };
      return this.renderedDeck = framework.renderDeck(renderContext);
    };

    SlideDeck.prototype.write = function(filepath) {
      filepath = et(filepath);
      fs.outputFileSync(path.join(filepath, 'index.html'), this.renderedDeck);
      return this.collections.writeAllSync(path.join(filepath, 'collections'));
    };

    return SlideDeck;

  })();

  PresentationFramework = (function() {
    function PresentationFramework(framework) {
      var frameworkPath, fwfuns, helpersPath, templatePath;
      log.info('Looking for presentation framework module: ', framework);
      frameworkPath = path.join(__dirname, '../extensions/frameworks', framework);
      templatePath = path.join(frameworkPath, 'template.html');
      this.template = fs.readFileSync(templatePath, 'utf8');
      helpersPath = path.join(frameworkPath, 'helpers.js');
      fwfuns = require(helpersPath);
      this.renderer = handlebars.compile(this.template);
      this.slideProcessors = fwfuns['slideProcessors'];
      this.showHelpers = fwfuns['showHelpers'];
      this.renderDeck = (function(_this) {
        return function(renderContext) {
          var deck;
          Object.keys(_this.showHelpers).forEach(function(key) {
            return handlebars.registerHelper(key, _this.showHelpers[key]);
          });
          deck = _this.renderer(renderContext);
          return deck;
        };
      })(this);
      this;
    }

    return PresentationFramework;

  })();

  exports.yamlToSpec = function(filepath) {
    var inputSpecification, specification;
    inputSpecification = fs.readFileSync(filepath, 'utf8');
    specification = yaml.load(inputSpecification);
    specification.slides.forEach(function(slide, index) {
      return specification.slides[index] = slide.split('.');
    });
    return specification;
  };

  exports.compile = function(spec, outdir) {
    var collections, deck, plugin;
    log.info('Compiling slideshow...');
    log.info('Loading presentation framework...');
    plugin = new PresentationFramework(spec.framework);
    log.info('Loading slide collections...');
    collections = new CollectionManager(spec.collections);
    collections.parseCollections();
    log.info('Assembling slide deck...');
    deck = new SlideDeck(spec.title, spec.author, collections);
    deck.assemble(spec.slides);
    log.info('Pre Processing slides...');
    deck.preProcessSlides(plugin);
    log.info('Rendering slideshow...');
    deck.render(plugin);
    log.info('Writing slideshow...');
    return deck.write(outdir);
  };

  log = logger();

}).call(this);