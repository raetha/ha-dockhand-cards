/**
 * Editor bundle entry point — loaded separately from the card bundle as a
 * second Lovelace resource registered by hacs.json / the integration's own
 * resource setup.  Every editor self-registers its own custom element on
 * import; nothing further is needed here beyond importing them all.
 *
 * Cards call getConfigElement() without a dynamic import — by the time
 * anyone opens a card editor HA will already have loaded this file, so the
 * custom elements are already registered.
 */
import './dockhand-container-card/editor';
import './dockhand-containers-card/editor';
import './dockhand-environment-card/editor';
import './dockhand-overview-card/editor';
import './dockhand-schedules-card/editor';
import './dockhand-stack-card/editor';
import './dockhand-stacks-card/editor';
import './dockhand-updates-card/editor';
import './dockhand-vulnerability-card/editor';
