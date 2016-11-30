'use strict';

const joi = require('joi');
const util = require('util');
const payload = joi.object().keys({
  'name': joi.string().required(),
  'dist-tags': joi.object().required(),
  '_attachments': joi.object().required()
}).unknown(true);

//
// Define routes.
//
module.exports = function routes(app, options, done) {
  app.perform('actions', function performRoutes(next) {
    app.contextLog.verbose('Adding application routes');

    //
    // Setup parameter handlers.
    //
    require('./params')(app);

    //
    // ### /build
    // Trigger a build. This route assume `npm publish` like JSON that contains
    // the package.json and the package's content as binary blob in `attachments`.
    //
    app.routes.post('/build', function build(req, res) {

      //
      // TODO: Add some retry to the API client underneath
      //
      function change() {
        app.feedsme.change(req.body.env || 'dev', {
          data: req.body
        }, function posted(error) {
          return error
            ? app.contextLog.error('Failed to process changes', error)
            : app.contextLog.info('Changes processed');
        });
      }

      //
      // Check some basic properties that always should be present.
      //
      joi.validate(req.body || {}, payload, function validated(error, data) {
        if (error) {
          return void app.terminate(res, error);
        }

        return app.construct.build(data, function building(err) {
          if (err) {
            return void app.contextLog.error('Failed to build', err);
          }

          app.contextLog.info('Build finished, sending change for %s', data.name);
          return void change();
        }).pipe(res);
      });
    });

    //
    // ### /cancel/:name/:version/:env?
    // Cancel a running build.
    //
    app.routes.get('/cancel/:name/:version/:env?', function cancel(req, res) {
      const data = req.params || {} ;
      const msg = util.format('build %s@%s cancelled', data.name, data.version);

      app.construct.destroyAll({
        env: data.env || 'dev',
        version: data.version,
        name: data.name
      }, new Error(msg), function cancelled(error) {
        if (error) {
          return void app.terminate(res, error);
        }

        app.contextLog.info(msg);
        return void res.end(msg);
      });
    });

    next();
  }, done);
};